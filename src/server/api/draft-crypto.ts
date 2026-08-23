import { openAead, sealAead } from "@/services/crypto/aead";
import { fromBase64, toBase64 } from "@/services/crypto/codec";
import type { DraftContent } from "./domain";
import { draftContentSchema } from "./domain";

// ---------------------------------------------------------------------------
// Issue #1965 (BETA-058) — Encrypted-at-rest draft cryptographic primitives
//
// Draft content (recipients, subject, body, attachment descriptors) is sealed
// using AES-256-GCM with authenticated associated data (AAD) strictly bound
// to the owner and draftId. No unencrypted draft payload is stored at rest.
// ---------------------------------------------------------------------------

export async function getDraftCryptoKey(owner: string): Promise<CryptoKey> {
  const normOwner = owner.toUpperCase().trim();
  const rawKeyMaterial = new TextEncoder().encode(`stealth:draft-encryption-v1:${normOwner}`);
  const hash = await crypto.subtle.digest("SHA-256", rawKeyMaterial);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealDraftContent(
  owner: string,
  draftId: string,
  content: DraftContent,
  customKey?: CryptoKey,
): Promise<{
  encryptedPayload: string;
  nonce: string;
  tag: string;
  algorithm: "AES-256-GCM";
}> {
  const key = customKey ?? (await getDraftCryptoKey(owner));
  const plaintext = new TextEncoder().encode(JSON.stringify(content));
  const aad = new TextEncoder().encode(`draft:${owner.toUpperCase().trim()}:${draftId}`);
  const { ciphertext, tag, nonce } = await sealAead(key, plaintext, undefined, aad);
  return {
    encryptedPayload: toBase64(ciphertext),
    nonce: toBase64(nonce),
    tag: toBase64(tag),
    algorithm: "AES-256-GCM",
  };
}

export async function openDraftContent(
  owner: string,
  draftId: string,
  record: { encryptedPayload: string; nonce: string; tag: string },
  customKey?: CryptoKey,
): Promise<DraftContent> {
  const key = customKey ?? (await getDraftCryptoKey(owner));
  const aad = new TextEncoder().encode(`draft:${owner.toUpperCase().trim()}:${draftId}`);
  const ciphertextBytes = fromBase64(record.encryptedPayload);
  const tagBytes = fromBase64(record.tag);
  const nonceBytes = fromBase64(record.nonce);
  const { plaintext } = await openAead(key, ciphertextBytes, tagBytes, nonceBytes, aad);
  const parsed = JSON.parse(new TextDecoder().decode(plaintext));
  return draftContentSchema.parse(parsed);
}
