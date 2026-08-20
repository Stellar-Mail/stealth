import { Keypair } from "@stellar/stellar-sdk";

export interface GeneratedStellarKeypair {
  publicKey: string;
  secretKey: string;
}

/**
 * Generate a fresh Stellar keypair on the trusted server.
 *
 * Callers MUST encrypt `secretKey` before persistence and MUST NOT return it
 * to clients or emit it in logs.
 */
export function generateStellarKeypair(): GeneratedStellarKeypair {
  const keypair = Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}
