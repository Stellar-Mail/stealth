// ---------------------------------------------------------------------------
// BETA-081 (Issue #1988) — encrypted backups and restore procedures.
//
// Types shared by the backup engine, the Miniflare-driven backup worker, the
// operator CLI, and the automated tests. The archive format is deliberately
// plain: a small non-sensitive header plus an AES-256-GCM ciphertext whose
// plaintext is the integrity manifest and the store entries. Keys (which can
// embed emails/usernames in secondary indexes) are fingerprinted in the
// manifest and only carried in full inside the encrypted payload.
// ---------------------------------------------------------------------------

/** The three beta data stores that must be recoverable. */
export type BackupStoreKind = "durable-object" | "kv" | "r2";

export const BACKUP_FORMAT = "stealth-backup" as const;
export const BACKUP_ARCHIVE_VERSION = 1 as const;

/** How a stored value is encoded inside the archive. */
export type BackupValueEncoding = "json" | "text" | "bytes";

/** A value read from a store plus the encoding needed to write it back. */
export interface BackupStoredValue {
  encoding: BackupValueEncoding;
  bytes: Uint8Array;
}

/**
 * Storage-agnostic surface the backup engine runs over. All three beta stores
 * (Durable Object, KV, R2) implement it; `listKeys` paginates to stay complete
 * past per-call key limits.
 */
export interface BackupStorage {
  readonly store: BackupStoreKind;
  listKeys(prefix?: string): Promise<string[]>;
  get(key: string): Promise<BackupStoredValue | null>;
  put(key: string, value: BackupStoredValue): Promise<void>;
  delete(key: string): Promise<void>;
}

/** A single (store, key) record captured into or written from an archive. */
export interface BackupEntry {
  store: BackupStoreKind;
  key: string;
  encoding: BackupValueEncoding;
  /** Raw value bytes. */
  value: Uint8Array;
}

/** One row of the integrity manifest (keys are fingerprinted, never verbatim). */
export interface BackupManifestEntry {
  store: BackupStoreKind;
  /** Redacted key fingerprint — never the full key. */
  key: string;
  /** SHA-256 hex digest of the value bytes. */
  digest: string;
  byteLength: number;
}

export interface BackupManifest {
  version: number;
  createdAt: string;
  stores: Array<{ store: BackupStoreKind; count: number; byteLength: number }>;
  entries: BackupManifestEntry[];
}

/** Non-sensitive archive header; all key material stays inside the ciphertext. */
export interface BackupArchiveHeader {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_ARCHIVE_VERSION;
  createdAt: string;
  generatedBy: string;
  /** Redacted environment label, e.g. "local-emulation". */
  source: string;
  encryption: {
    cipher: "AES-256-GCM";
    kdf: "HKDF-SHA256";
    kdfPurpose: "stealth-backup-v1";
    /** Non-secret identifier of the key that sealed the archive. */
    keyId: string;
  };
}

/** The full archive: header (plaintext) + AEAD seal of the payload. */
export interface BackupArchive extends BackupArchiveHeader {
  nonce: string;
  tag: string;
  ciphertext: string;
}

/** The plaintext carried inside the AEAD seal. */
export interface BackupPayload {
  manifest: BackupManifest;
  entries: Array<{
    store: BackupStoreKind;
    key: string;
    encoding: BackupValueEncoding;
    value: string;
  }>;
}

export type BackupCommand = "create" | "verify" | "restore" | "list" | "rehearsal";

export interface BackupRunOptions {
  /** Restrict collection/restore to specific stores. */
  stores?: BackupStoreKind[];
  /** Wipe each target store before restoring (rehearsal only). */
  wipeFirst?: boolean;
  /** Base64-encoded 32-byte AES key (operator tool only; never logged). */
  key?: string;
  /** Environment label recorded in the archive header. */
  source?: string;
}

export interface BackupCreateReport {
  command: "create";
  generatedAt: string;
  createdAt: string;
  ok: boolean;
  archive?: BackupArchive;
  /** Per-store counts in the archive (never keys or values). */
  stores: Array<{ store: BackupStoreKind; count: number; byteLength: number }>;
  /** Elapsed time for collection + sealing, for RPO/RTO evidence. */
  durationMs: number;
  errors: string[];
}

export interface BackupVerifyReport {
  command: "verify";
  generatedAt: string;
  ok: boolean;
  /** Total entries verified against the manifest. */
  verified: number;
  /** Manifest rows whose digest did not match (always redacted). */
  mismatches: number;
  errors: string[];
}

export interface BackupRestoreReport {
  command: "restore";
  generatedAt: string;
  ok: boolean;
  restored: number;
  /** Counts per store actually written. */
  stores: Array<{ store: BackupStoreKind; count: number; byteLength: number }>;
  /** Elapsed time for the restore, for RTO evidence. */
  durationMs: number;
  errors: string[];
}
