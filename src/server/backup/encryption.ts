// ---------------------------------------------------------------------------
// BETA-081 (Issue #1988) — backup archive encryption.
//
// The backup payload (manifest + entries) is sealed with AES-256-GCM using a
// key derived via HKDF-SHA256 from a dedicated `STEALTH_BACKUP_KEY` secret
// (base64, 32 bytes). The backup key is deliberately SEPARATE from production
// keys (cursor, storage, operator, …) so rotating backup material never
// touches live signing/wrapping material. The derived key is bound to the
// fixed purpose label `stealth-backup-v1`, so the same secret cannot be
// repurposed for another envelope format.
//
// Reuses the canonical AEAD wire format (`src/services/crypto/aead.ts`) so
// ciphertext excludes the tag and the tag is stored separately — identical to
// the managed-wallet envelope convention.
// ---------------------------------------------------------------------------

import { sealAead, openAead } from "@/services/crypto/aead";
import { fromBase64, toBase64, toHex } from "@/services/crypto/codec";
import { hkdfExtract, hkdfExpand } from "@/services/crypto/kdf";

import type { BackupArchive, BackupArchiveHeader, BackupManifest, BackupPayload } from "./types";

export const BACKUP_KDF_PURPOSE = "stealth-backup-v1";
export const BACKUP_KEY_BYTES = 32;
const BACKUP_KEY_ID_BYTES = 8;

export class BackupCryptoError extends Error {
  readonly code = "backup_crypto_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "BackupCryptoError";
  }
}

function buf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(u.length));
  out.set(u);
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf(bytes));
  return toHex(new Uint8Array(digest));
}

/**
 * Derive the AES-256-GCM backup key from a base64-encoded 32-byte secret.
 * The purpose label binds the key to the backup format.
 */
export async function deriveBackupKey(base64Key: string): Promise<CryptoKey> {
  let ikm: Uint8Array | undefined;
  try {
    ikm = fromBase64(base64Key, BACKUP_KEY_BYTES);
    const prk = await hkdfExtract(ikm);
    const keyBytes = await hkdfExpand(prk, new TextEncoder().encode(BACKUP_KDF_PURPOSE), 32);
    return await crypto.subtle.importKey("raw", buf(keyBytes), { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  } catch (error) {
    if (error instanceof BackupCryptoError) throw error;
    throw new BackupCryptoError("Unable to derive the backup key from STEALTH_BACKUP_KEY");
  } finally {
    if (ikm) ikm.fill(0);
  }
}

/**
 * Non-secret key identifier recorded in the archive header so operators can
 * confirm which key version sealed a backup without exposing the key itself.
 */
export async function backupKeyId(base64Key: string): Promise<string> {
  const bytes = fromBase64(base64Key, BACKUP_KEY_BYTES);
  const digest = await crypto.subtle.digest("SHA-256", buf(bytes));
  return toHex(new Uint8Array(digest).slice(0, BACKUP_KEY_ID_BYTES));
}

/**
 * Builds the canonical AAD for the archive: the non-sensitive header fields.
 * Any header tampering therefore fails authentication on open.
 */
export function archiveAad(header: BackupArchiveHeader): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      format: header.format,
      version: header.version,
      createdAt: header.createdAt,
      source: header.source,
      encryption: header.encryption,
    }),
  );
}

export interface SealedBackup {
  header: BackupArchiveHeader;
  nonce: string;
  tag: string;
  ciphertext: string;
}

/** Seals the payload JSON under the derived backup key. */
export async function sealBackupPayload(
  key: CryptoKey,
  header: BackupArchiveHeader,
  payload: BackupPayload,
): Promise<SealedBackup> {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const sealed = await sealAead(key, plaintext, undefined, archiveAad(header));
  return {
    header,
    nonce: toBase64(sealed.nonce),
    tag: toBase64(sealed.tag),
    ciphertext: toBase64(sealed.ciphertext),
  };
}

/** Authenticates and opens the archive, returning the decrypted payload. */
export async function openBackupPayload(
  key: CryptoKey,
  archive: BackupArchive,
): Promise<BackupPayload> {
  const payload = JSON.parse(
    new TextDecoder().decode(
      (
        await openAead(
          key,
          fromBase64(archive.ciphertext),
          fromBase64(archive.tag),
          fromBase64(archive.nonce),
          archiveAad(archive),
        )
      ).plaintext,
    ),
  ) as BackupPayload;
  if (!payload || !Array.isArray(payload.entries) || !payload.manifest) {
    throw new BackupCryptoError("Backup payload is malformed");
  }
  return payload;
}

/** SHA-256 hex digest of a value byte array (used for manifest integrity). */
export function digestValue(value: Uint8Array): Promise<string> {
  return sha256Hex(value);
}

export type { BackupManifest };
