/**
 * Recipient key injection for the live reader (BETA-055).
 *
 * The decrypt path never invents a key. Production registers a KeyProvider
 * from the session/wallet layer; tests inject a static provider. Missing keys
 * fail closed through the inbound pipeline.
 */

import { OpenEnvelopeError, type KeyProvider } from "@/services/crypto/open-envelope";

const MISSING_KEY_PROVIDER: KeyProvider = {
  async resolveKey() {
    throw new OpenEnvelopeError("recipient key unavailable", "crypto_decryption_error");
  },
};

let registered: KeyProvider | null = null;

export function registerMailboxKeyProvider(provider: KeyProvider | null): void {
  registered = provider;
}

export function getMailboxKeyProvider(): KeyProvider {
  return registered ?? MISSING_KEY_PROVIDER;
}

export function createStaticKeyProvider(key: CryptoKey, recipient: string): KeyProvider {
  const expected = recipient.toUpperCase().trim();
  return {
    async resolveKey(resolvedRecipient) {
      if (resolvedRecipient.toUpperCase().trim() !== expected) {
        throw new OpenEnvelopeError("recipient key unavailable", "crypto_decryption_error");
      }
      return key;
    },
  };
}
