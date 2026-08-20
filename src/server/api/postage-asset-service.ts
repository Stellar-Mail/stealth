import { loadRuntimeConfig, type BetaRuntimeConfig } from "../../config";
import {
  config as readPostageContractConfig,
  createPostageClient,
} from "@/services/stellar/contracts/postage";

// ---------------------------------------------------------------------------
// BETA-039 (Issue #1946) — authenticated postage quotes from live policy and
// testnet asset data.
//
// Quotes must bind the configured testnet asset, the current network
// passphrase, the recipient's off-chain policy version, the message identity
// and an expiry window. This module resolves the "configured testnet asset"
// slice of that binding:
//
// - In production (STEALTH_POSTAGE_LIVE=true) the postage contract's
//   `config()` read is the authoritative source for the accepted asset, the
//   fee basis points and the contract windows. The live Horizon read supplies
//   balance guidance for the sending account.
// - In development/test (no live opt-in) a deterministic configured fallback
//   is used so isolated unit tests never depend on a deployed testnet.
//
// The provider is injectable so domain tests may exercise insufficient-balance
// and other boundary cases with mocks, exactly as the issue permits.
// ---------------------------------------------------------------------------

export interface PostageAssetInfo {
  /** Configured testnet asset (Stellar address / asset contract) accepted for escrow. */
  asset: string;
  /** Contract-level minimum postage in stroops (off-chain policy minimum still applies). */
  minimum: string;
  /** Fee basis points applied to the quoted amount (0 = no fee). */
  feeBps: number;
  /** Contract expiry window in seconds. */
  expirySeconds: number;
  /** Contract dispute window in seconds. */
  disputeSeconds: number;
  /** Network passphrase the quote is bound to. */
  network: string;
  /** Provenance of the resolved values: `contract` (live) or `configured` (fallback). */
  source: "contract" | "configured";
}

export interface PostageBalanceInfo {
  /** Sender balance in stroops, or null when not observable. */
  available: string | null;
  /** Whether the observed balance covers the quoted amount, or null when unobserved. */
  sufficient: boolean | null;
}

export interface PostageAssetProvider {
  getAssetInfo(): Promise<PostageAssetInfo>;
  getSenderBalance(sender: string): Promise<PostageBalanceInfo>;
}

export const DEFAULT_POSTAGE_ASSET = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
export const DEFAULT_POSTAGE_MINIMUM = "0";
export const DEFAULT_POSTAGE_FEE_BPS = 0;
export const DEFAULT_POSTAGE_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_POSTAGE_DISPUTE_SECONDS = 7 * 24 * 60 * 60;

function envString(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

function envInt(key: string, fallback: number): number {
  const value = process.env[key];
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function safeLoadConfig(): BetaRuntimeConfig {
  try {
    return loadRuntimeConfig();
  } catch {
    return loadRuntimeConfig({ profile: "development", env: {} });
  }
}

/**
 * Deterministic configured fallback for the testnet asset binding. Used in
 * development/test and as the failure fallback for a live contract read.
 */
export function resolveConfiguredPostageAsset(config: BetaRuntimeConfig): PostageAssetInfo {
  return {
    asset: envString("STEALTH_POSTAGE_ASSET", DEFAULT_POSTAGE_ASSET),
    minimum: envString("STEALTH_POSTAGE_MINIMUM", DEFAULT_POSTAGE_MINIMUM),
    feeBps: envInt("STEALTH_POSTAGE_FEE_BPS", DEFAULT_POSTAGE_FEE_BPS),
    expirySeconds: envInt("STEALTH_POSTAGE_EXPIRY_SECONDS", DEFAULT_POSTAGE_EXPIRY_SECONDS),
    disputeSeconds: envInt("STEALTH_POSTAGE_DISPUTE_SECONDS", DEFAULT_POSTAGE_DISPUTE_SECONDS),
    network: config.network.networkPassphrase,
    source: "configured",
  };
}

/** Converts a Horizon XLM balance string to stroops (7 decimal places). */
export function xlmToStroops(xlm: string): string {
  try {
    const [whole = "0", frac = ""] = xlm.split(".");
    const scaled = (frac + "0000000").slice(0, 7);
    return (BigInt(whole || "0") * 10_000_000n + BigInt(scaled || "0")).toString();
  } catch {
    return "0";
  }
}

/**
 * Runtime asset/balance provider. Live contract and Horizon reads are gated
 * behind an explicit opt-in so unit tests stay hermetic; production deployments
 * opt in and exercise the real testnet path.
 */
export class RuntimePostageAssetProvider implements PostageAssetProvider {
  private readonly config: BetaRuntimeConfig;
  private readonly live: boolean;

  constructor(config: BetaRuntimeConfig = safeLoadConfig()) {
    this.config = config;
    this.live = process.env.STEALTH_POSTAGE_LIVE === "true";
  }

  async getAssetInfo(): Promise<PostageAssetInfo> {
    if (!this.live) {
      return resolveConfiguredPostageAsset(this.config);
    }

    try {
      const client = createPostageClient({
        contractId: this.config.contract.postageContractId,
        networkPassphrase: this.config.network.networkPassphrase,
        rpcUrl: this.config.network.sorobanRpcUrl,
      });
      const result = await readPostageContractConfig(client);
      if (result.isOk()) {
        const cfg = result.unwrap();
        return {
          asset: cfg.asset,
          minimum: cfg.minimum.toString(),
          feeBps: cfg.fee_bps,
          expirySeconds: Number(cfg.expiry_seconds),
          disputeSeconds: Number(cfg.dispute_seconds),
          network: this.config.network.networkPassphrase,
          source: "contract",
        };
      }
    } catch {
      // Live read failed (contract not deployed / RPC unreachable): fall back
      // to the configured asset so quoting degrades rather than breaks.
    }

    return resolveConfiguredPostageAsset(this.config);
  }

  async getSenderBalance(sender: string): Promise<PostageBalanceInfo> {
    if (!this.live) {
      return { available: null, sufficient: null };
    }

    try {
      const res = await fetch(`${this.config.network.horizonUrl}/accounts/${sender}`);
      if (!res.ok) {
        return { available: null, sufficient: null };
      }
      const account = (await res.json()) as {
        balances?: Array<{ asset_type: string; balance?: string }>;
      };
      const native = account.balances?.find((balance) => balance.asset_type === "native");
      if (!native || native.balance === undefined) {
        return { available: null, sufficient: null };
      }
      return { available: xlmToStroops(native.balance), sufficient: null };
    } catch {
      return { available: null, sufficient: null };
    }
  }
}

/** Reusable mock provider for isolated unit tests. */
export class StaticPostageAssetProvider implements PostageAssetProvider {
  constructor(
    private readonly assetInfo: PostageAssetInfo,
    private readonly balance: PostageBalanceInfo = { available: null, sufficient: null },
  ) {}

  async getAssetInfo(): Promise<PostageAssetInfo> {
    return this.assetInfo;
  }

  async getSenderBalance(): Promise<PostageBalanceInfo> {
    return this.balance;
  }
}
