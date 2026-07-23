/**
 * Internal dependency injection for deterministic cryptographic tests.
 *
 * NEVER EXPORT THIS FROM PUBLIC INDEX. NEVER USE IN PRODUCTION.
 */

export interface CryptoTestVectors {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
  now?: () => Date;
  generateKey?: (
    algorithm:
      | AlgorithmIdentifier
      | RsaHashedKeyGenParams
      | EcKeyGenParams
      | HmacKeyGenParams
      | AesKeyGenParams,
    extractable: boolean,
    keyUsages: KeyUsage[],
  ) => Promise<any>;
}

let currentVectors: CryptoTestVectors = {};

export function setCryptoTestVectors(vectors: CryptoTestVectors): void {
  currentVectors = { ...currentVectors, ...vectors };
}

export function resetCryptoTestVectors(): void {
  currentVectors = {};
}

export function getCryptoTestVectors(): CryptoTestVectors {
  return currentVectors;
}
