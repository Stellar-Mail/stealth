import type { BetaRuntimeConfig } from "../../config/schema";
import type { StellarFundingAdapter } from "@/services/stellar/funding-adapter";
import { generateStellarKeypair } from "./keypair";
import { encryptWalletSecret } from "./wallet-secret-crypto";
import { enforceCapability } from "@/server/api/beta-controls/guard";

export interface PrepareManagedWalletInput {
  userId: string;
  storageSecret: string;
  now?: Date;
}

export interface PreparedManagedWallet {
  address: string;
  encryptedSecret: Awaited<ReturnType<typeof encryptWalletSecret>>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Generate and encrypt a managed Stellar keypair on the trusted server.
 *
 * The plaintext seed exists only for the duration of this call and must never
 * be logged or returned to clients.
 */
export async function prepareManagedWalletSecret(
  input: PrepareManagedWalletInput,
): Promise<PreparedManagedWallet> {
  const now = (input.now ?? new Date()).toISOString();
  const { publicKey, secretKey } = generateStellarKeypair();
  const encryptedSecret = await encryptWalletSecret(secretKey, input.storageSecret);
  return {
    address: publicKey,
    encryptedSecret,
    createdAt: now,
    updatedAt: now,
  };
}

export function assertTestnetManagedWalletNetwork(config: BetaRuntimeConfig): void {
  if (config.network.stellarNetwork !== "testnet") {
    throw new Error("Managed wallet provisioning is testnet-only during beta");
  }
}

export async function fundManagedWalletAccount(
  fundingAdapter: StellarFundingAdapter,
  publicKey: string,
): Promise<{ funded: boolean; transactionId?: string }> {
  // BETA-095: operator kill switch for funding managed wallets. Fails closed.
  await enforceCapability("funding");
  return fundingAdapter.fundAccount(publicKey);
}
