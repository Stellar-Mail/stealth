import { GCM_NONCE_BYTES, openAead, sealAead } from "../crypto/aead";
import type { EncryptedWalletSecret } from "../../server/api/domain";

const MANAGED_WALLET_KEY_VERSION = 1;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    out[index] = binary.charCodeAt(index);
  }
  return out;
}

async function deriveWalletEncryptionKey(storageSecret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(storageSecret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Encrypt a managed-wallet seed for durable storage using the server storage
 * secret. Plaintext seeds must never be written to storage.
 */
export async function encryptWalletSecret(
  secretKey: string,
  storageSecret: string,
): Promise<EncryptedWalletSecret> {
  const key = await deriveWalletEncryptionKey(storageSecret);
  const sealed = await sealAead(key, new TextEncoder().encode(secretKey));
  if (sealed.nonce.length !== GCM_NONCE_BYTES) {
    throw new Error("Managed wallet encryption produced an invalid nonce length");
  }
  return {
    ciphertext: toBase64(sealed.ciphertext),
    nonce: toBase64(sealed.nonce),
    tag: toBase64(sealed.tag),
    keyVersion: MANAGED_WALLET_KEY_VERSION,
  };
}

/**
 * Decrypt a managed-wallet seed for server-side signing. Never expose the
 * returned value to clients.
 */
export async function decryptWalletSecret(
  encrypted: EncryptedWalletSecret,
  storageSecret: string,
): Promise<string> {
  const key = await deriveWalletEncryptionKey(storageSecret);
  const opened = await openAead(
    key,
    fromBase64(encrypted.ciphertext),
    fromBase64(encrypted.tag),
    fromBase64(encrypted.nonce),
  );
  return new TextDecoder().decode(opened.plaintext);
}
