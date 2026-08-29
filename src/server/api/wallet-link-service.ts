import { recordAuditEvent } from "./audit";
import type { ExternalWallet, ExternalWalletChallenge, WalletCapability } from "./domain";
import { ApiError } from "./errors";
import type { ApiRepository } from "./repository";
import { enforceCapability } from "./beta-controls/guard";

const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

function generateChallenge(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createChallenge(
  repository: ApiRepository,
  owner: string,
  externalAddress: string,
  network: string,
): Promise<ExternalWalletChallenge> {
  const existing = await repository.getWalletChallenge(owner, externalAddress);
  if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
    return existing;
  }

  const challenge: ExternalWalletChallenge = {
    challenge: generateChallenge(),
    address: externalAddress,
    expiresAt: new Date(Date.now() + CHALLENGE_EXPIRY_MS).toISOString(),
    network,
  };

  await repository.setWalletChallenge(owner, externalAddress, challenge);
  return challenge;
}

export async function verifyChallenge(
  repository: ApiRepository,
  owner: string,
  externalAddress: string,
  signature: string,
  signerAddress: string,
  network: string,
): Promise<{ verified: boolean; reason?: string }> {
  const stored = await repository.getWalletChallenge(owner, externalAddress);
  if (!stored) {
    return { verified: false, reason: "no_challenge_found" };
  }

  if (new Date(stored.expiresAt).getTime() <= Date.now()) {
    await repository.deleteWalletChallenge(owner, externalAddress);
    return { verified: false, reason: "challenge_expired" };
  }

  if (stored.address !== externalAddress) {
    return { verified: false, reason: "address_mismatch" };
  }

  if (stored.network !== network) {
    return { verified: false, reason: "network_mismatch" };
  }

  if (signerAddress !== externalAddress) {
    return { verified: false, reason: "signer_mismatch" };
  }

  if (!signature || signature.length === 0) {
    return { verified: false, reason: "invalid_signature" };
  }

  await repository.deleteWalletChallenge(owner, externalAddress);
  return { verified: true };
}

export async function linkExternalWallet(
  repository: ApiRepository,
  owner: string,
  wallet: ExternalWallet,
): Promise<ExternalWallet> {
  // BETA-095: operator kill switch for external wallet linking. Fails closed.
  await enforceCapability("walletLinking");
  const existing = await repository.getExternalWallets(owner);
  const duplicate = existing.find((w) => w.address === wallet.address);
  if (duplicate) {
    throw new ApiError(409, "conflict", "This external wallet is already linked");
  }

  const ownerWithAddress = await repository.findExternalWalletOwner(wallet.address);
  if (ownerWithAddress && ownerWithAddress !== owner) {
    throw new ApiError(403, "forbidden", "This wallet is linked to another account");
  }

  return repository.setExternalWallet(owner, wallet);
}

export interface ActiveSigner {
  signerType: "external" | "managed";
  address: string;
  capabilities: WalletCapability[];
  isFallback: boolean;
}

export async function resolveActiveSigner(
  repository: ApiRepository,
  owner: string,
): Promise<ActiveSigner> {
  const wallets = await repository.getExternalWallets(owner);
  const signWallet = wallets.find((w) => w.capabilities.includes("sign"));
  if (signWallet) {
    return {
      signerType: "external",
      address: signWallet.address,
      capabilities: signWallet.capabilities,
      isFallback: false,
    };
  }
  return {
    signerType: "managed",
    address: owner,
    capabilities: ["sign", "send", "read"],
    isFallback: true,
  };
}

export async function resolveTransactionSigner(
  repository: ApiRepository,
  owner: string,
  targetSignerAddress?: string,
): Promise<ActiveSigner> {
  if (!targetSignerAddress) {
    return resolveActiveSigner(repository, owner);
  }
  const wallets = await repository.getExternalWallets(owner);
  const matched = wallets.find(
    (w) => w.address === targetSignerAddress && w.capabilities.includes("sign"),
  );
  if (matched) {
    return {
      signerType: "external",
      address: matched.address,
      capabilities: matched.capabilities,
      isFallback: false,
    };
  }
  return {
    signerType: "managed",
    address: owner,
    capabilities: ["sign", "send", "read"],
    isFallback: true,
  };
}

export async function unlinkExternalWallet(
  repository: ApiRepository,
  owner: string,
  address: string,
  requestId = "unknown",
): Promise<ActiveSigner> {
  try {
    const wallets = await repository.getExternalWallets(owner);
    const targetWallet = wallets.find((w) => w.address === address);

    if (!targetWallet) {
      recordAuditEvent({
        actor: owner,
        action: "wallet_link.unlink",
        targetType: "external_wallet",
        safeTargetReference: address,
        result: "denied",
        requestId,
      });
      throw new ApiError(404, "not_found", "External wallet not found");
    }

    if (address === owner && wallets.length <= 1) {
      recordAuditEvent({
        actor: owner,
        action: "wallet_link.unlink",
        targetType: "external_wallet",
        safeTargetReference: address,
        result: "denied",
        requestId,
      });
      throw new ApiError(
        400,
        "bad_request",
        "Cannot remove the primary or only account access method",
      );
    }

    await repository.deleteWalletChallenge(owner, address);
    await repository.removeExternalWallet(owner, address);

    recordAuditEvent({
      actor: owner,
      action: "wallet_link.unlink",
      targetType: "external_wallet",
      safeTargetReference: address,
      result: "success",
      requestId,
    });

    return resolveActiveSigner(repository, owner);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      recordAuditEvent({
        actor: owner,
        action: "wallet_link.unlink",
        targetType: "external_wallet",
        safeTargetReference: address,
        result: "denied",
        requestId,
      });
    }
    throw error;
  }
}

export async function listExternalWallets(
  repository: ApiRepository,
  owner: string,
): Promise<ExternalWallet[]> {
  return repository.getExternalWallets(owner);
}

export async function updateExternalWalletCapabilities(
  repository: ApiRepository,
  owner: string,
  address: string,
  capabilities: WalletCapability[],
  requestId = "unknown",
): Promise<{ wallet: ExternalWallet; activeSigner: ActiveSigner }> {
  if (capabilities.length === 0) {
    throw new ApiError(400, "validation_error", "At least one capability is required");
  }

  const wallets = await repository.getExternalWallets(owner);
  const targetWallet = wallets.find((w) => w.address === address);

  if (!targetWallet) {
    recordAuditEvent({
      actor: owner,
      action: "wallet_link.update_capabilities",
      targetType: "external_wallet",
      safeTargetReference: address,
      result: "denied",
      requestId,
    });
    throw new ApiError(404, "not_found", "External wallet not found");
  }

  const updatedWallet: ExternalWallet = {
    ...targetWallet,
    capabilities,
  };

  const saved = await repository.setExternalWallet(owner, updatedWallet);

  recordAuditEvent({
    actor: owner,
    action: "wallet_link.update_capabilities",
    targetType: "external_wallet",
    safeTargetReference: address,
    result: "success",
    requestId,
  });

  const activeSigner = await resolveActiveSigner(repository, owner);
  return { wallet: saved, activeSigner };
}

export async function getManagedWalletStatus(
  repository: ApiRepository,
  owner: string,
  horizonUrl?: string,
  network = "Test SDF Network ; September 2015",
): Promise<import("./domain").ManagedWalletStatus> {
  const activeSigner = await resolveActiveSigner(repository, owner);

  let availableStroops: string | null = null;
  let balanceXlm: string | null = null;
  let status: "active" | "funded" | "unfunded" = "active";

  const isLive =
    process.env.STEALTH_POSTAGE_LIVE === "true" ||
    process.env.STEALTH_LIVE_HORIZON === "true" ||
    process.env.NODE_ENV === "production";

  if (horizonUrl && isLive) {
    try {
      const res = await fetch(`${horizonUrl}/accounts/${owner}`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const account = (await res.json()) as {
          balances?: Array<{ asset_type: string; balance?: string }>;
        };
        const native = account.balances?.find((b) => b.asset_type === "native");
        if (native && native.balance !== undefined) {
          balanceXlm = native.balance;
          const [whole = "0", frac = ""] = native.balance.split(".");
          const scaled = (frac + "0000000").slice(0, 7);
          availableStroops = (
            BigInt(whole || "0") * 10_000_000n +
            BigInt(scaled || "0")
          ).toString();
          status = BigInt(availableStroops) > 0n ? "funded" : "unfunded";
        }
      } else if (res.status === 404) {
        status = "unfunded";
        availableStroops = "0";
        balanceXlm = "0";
      }
    } catch {
      // Degrade gracefully if Horizon unreachable or timeout
    }
  }

  return {
    address: owner,
    status,
    network,
    balance: {
      available: availableStroops,
      balanceXlm,
    },
    capabilities: ["sign", "send", "read"],
    isDefaultSigner: activeSigner.signerType === "managed",
    activeSigner,
  };
}
