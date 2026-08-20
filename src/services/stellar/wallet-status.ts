import type { ApiRepository } from "../../server/api/repository";
import { ApiError } from "../../server/api/errors";
import type { BetaRuntimeConfig } from "../../config/schema";
import { loadRuntimeConfig } from "../../config";
import type { FundingOperation, ManagedWalletRecord } from "../../server/api/domain";
import { fundingOperationIdForUser } from "./funding";

/** TTL for a Horizon/RPC balance read before it is considered stale. */
export const WALLET_STATUS_TTL_MS = 30_000;

export type WalletActivationState = "pending" | "active" | "failed";
export type WalletStatusFreshness = "fresh" | "stale" | "unavailable";

/**
 * Public wallet status. This type is intentionally a different shape from any
 * custody/record type — it has no field that can hold a seed, secret, or
 * encrypted private key.
 */
export interface PublicWalletStatus {
  address: string;
  network: "testnet";
  networkPassphrase: string;
  balanceXlm: string | null;
  activation: WalletActivationState;
  lastSyncedAt: string | null;
  stale: boolean;
  freshness: WalletStatusFreshness;
}

export interface HorizonBalanceResult {
  nativeBalanceXlm: string;
}

export interface HorizonAccountReader {
  readNativeBalance(address: string): Promise<HorizonBalanceResult | "not_found">;
}

export class WalletRpcUnavailableError extends Error {
  constructor(message = "Wallet RPC is unavailable") {
    super(message);
    this.name = "WalletRpcUnavailableError";
  }
}

export interface WalletStatusSnapshot {
  nativeBalanceXlm: string | null;
  fetchedAt: string;
  available: boolean;
}

export interface WalletStatusCache {
  get(address: string): Promise<WalletStatusSnapshot | null>;
  set(address: string, snapshot: WalletStatusSnapshot): Promise<void>;
}

export class MemoryWalletStatusCache implements WalletStatusCache {
  private readonly snapshots = new Map<string, WalletStatusSnapshot>();

  async get(address: string): Promise<WalletStatusSnapshot | null> {
    return this.snapshots.get(address) ?? null;
  }

  async set(address: string, snapshot: WalletStatusSnapshot): Promise<void> {
    this.snapshots.set(address, snapshot);
  }

  clear(): void {
    this.snapshots.clear();
  }
}

let defaultCache = new MemoryWalletStatusCache();

/** Reset the process-level Horizon cache (tests only). */
export function resetDefaultWalletStatusCache(): void {
  defaultCache = new MemoryWalletStatusCache();
}

export class HorizonAccountReaderImpl implements HorizonAccountReader {
  constructor(
    private readonly horizonUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async readNativeBalance(address: string): Promise<HorizonBalanceResult | "not_found"> {
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.horizonUrl.replace(/\/$/, "")}/accounts/${encodeURIComponent(address)}`,
        { signal: AbortSignal.timeout(8_000) },
      );
    } catch {
      throw new WalletRpcUnavailableError();
    }

    if (response.status === 404) {
      return "not_found";
    }
    if (!response.ok) {
      throw new WalletRpcUnavailableError(`Horizon returned status ${response.status}`);
    }

    const payload = (await response.json()) as {
      balances?: Array<{ asset_type: string; balance?: string }>;
    };
    const native = payload.balances?.find((balance) => balance.asset_type === "native");
    return { nativeBalanceXlm: native?.balance ?? "0" };
  }
}

export function activationFromWallet(
  wallet: ManagedWalletRecord,
  operation: FundingOperation | null,
): WalletActivationState {
  if (wallet.fundingStatus === "funded") return "active";
  if (wallet.fundingStatus === "failed" || operation?.status === "failed") return "failed";
  return "pending";
}

const SECRET_KEY_PATTERN = /secret|seed|cipher|private|encrypted|nonce|tag|mnemonic/i;

export function assertPublicWalletStatus(value: PublicWalletStatus): PublicWalletStatus {
  for (const key of Object.keys(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      throw new Error("Public wallet status must not include custody fields");
    }
  }
  return value;
}

export async function readPublicWalletStatus(input: {
  repository: ApiRepository;
  actorAddress: string;
  requestedAddress?: string;
  now?: Date;
  config?: BetaRuntimeConfig;
  horizon?: HorizonAccountReader;
  cache?: WalletStatusCache;
  ttlMs?: number;
}): Promise<PublicWalletStatus> {
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? WALLET_STATUS_TTL_MS;
  const config = input.config ?? loadRuntimeConfig();
  const cache = input.cache ?? defaultCache;

  const user = await input.repository.getUserByAddress(input.actorAddress);
  if (!user) {
    throw new ApiError(404, "not_found", "Account not found");
  }

  const wallet = await input.repository.getManagedWallet(user.userId);
  if (!wallet) {
    throw new ApiError(404, "not_found", "Managed wallet not found");
  }

  if (wallet.userId !== user.userId) {
    throw new ApiError(403, "forbidden", "Wallet metadata is only visible to its owner");
  }

  if (input.requestedAddress && input.requestedAddress !== wallet.address) {
    throw new ApiError(403, "forbidden", "Wallet metadata is only visible to its owner");
  }

  const operation = await input.repository.getFundingOperation(
    fundingOperationIdForUser(user.userId),
  );
  const activation = activationFromWallet(wallet, operation);

  const horizon = input.horizon ?? new HorizonAccountReaderImpl(config.network.horizonUrl);
  const cached = await cache.get(wallet.address);
  const ageMs = cached
    ? now.getTime() - new Date(cached.fetchedAt).getTime()
    : Number.POSITIVE_INFINITY;
  const cacheFresh = Boolean(cached && ageMs < ttlMs);

  if (cacheFresh && cached) {
    return assertPublicWalletStatus({
      address: wallet.address,
      network: "testnet",
      networkPassphrase: config.network.networkPassphrase,
      balanceXlm: cached.nativeBalanceXlm,
      activation,
      lastSyncedAt: cached.fetchedAt,
      stale: false,
      freshness: cached.available ? "fresh" : "unavailable",
    });
  }

  try {
    const live = await horizon.readNativeBalance(wallet.address);
    const snapshot: WalletStatusSnapshot = {
      nativeBalanceXlm: live === "not_found" ? null : live.nativeBalanceXlm,
      fetchedAt: now.toISOString(),
      available: true,
    };
    await cache.set(wallet.address, snapshot);
    return assertPublicWalletStatus({
      address: wallet.address,
      network: "testnet",
      networkPassphrase: config.network.networkPassphrase,
      balanceXlm: snapshot.nativeBalanceXlm,
      activation,
      lastSyncedAt: snapshot.fetchedAt,
      stale: false,
      freshness: "fresh",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (cached?.available) {
      return assertPublicWalletStatus({
        address: wallet.address,
        network: "testnet",
        networkPassphrase: config.network.networkPassphrase,
        balanceXlm: cached.nativeBalanceXlm,
        activation,
        lastSyncedAt: cached.fetchedAt,
        stale: true,
        freshness: "stale",
      });
    }
    return assertPublicWalletStatus({
      address: wallet.address,
      network: "testnet",
      networkPassphrase: config.network.networkPassphrase,
      balanceXlm: null,
      activation,
      lastSyncedAt: cached?.fetchedAt ?? null,
      stale: true,
      freshness: "unavailable",
    });
  }
}
