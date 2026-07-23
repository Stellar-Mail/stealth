export interface ContentKeyOptions {
  length?: 128 | 192 | 256;
  /**
   * Whether the key can be exported using exportKey.
   * Defaults to false for security hardening (Issue #1691).
   */
  extractable?: boolean;
  usages?: KeyUsage[];
}

/**
 * Generates an AES-GCM content-encryption key.
 * By default, keys are non-extractable (`extractable: false`).
 */
export async function generateContentKey(
  options: ContentKeyOptions = {}
): Promise<CryptoKey> {
  const {
    length = 256,
    extractable = false, // Enforce non-extractable by default
    usages = ['encrypt', 'decrypt'],
  } = options;

  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length,
    },
    extractable,
    usages
  );
}

/**
 * Seals content into an envelope by encrypting payload data with a non-extractable AES key
 * and wrapping the content key for the intended recipient.
 */
export async function sealEnvelope(
  payload: Uint8Array,
  recipientPublicKey: CryptoKey
): Promise<{ encryptedData: ArrayBuffer; wrappedKey: ArrayBuffer; iv: Uint8Array }> {
  // Generate non-extractable content key within the wrapping boundary
  const contentKey = await generateContentKey({ extractable: false });
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt payload using non-extractable key
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    contentKey,
    payload
  );

  // Wrap key within the boundary using Web Crypto wrapKey
  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    contentKey,
    recipientPublicKey,
    { name: 'RSA-OAEP' }
  );

  return { encryptedData, wrappedKey, iv };
}
