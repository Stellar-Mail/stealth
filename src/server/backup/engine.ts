// ---------------------------------------------------------------------------
// BETA-081 (Issue #1988) — backup engine.
//
// The engine is a pure module over the `BackupStorage` surface, so the exact
// same code runs:
//   1. as unit tests against in-memory stores,
//   2. against local Cloudflare emulation (Miniflare) via the backup worker,
//   3. inside a Durable Object when an operator runs the CLI commands.
//
// Contract:
//   - Restorable: an archive can be verified and restored byte-for-byte.
//   - Integrity: the manifest carries a SHA-256 digest per entry; verify
//     recomputes digests over the decrypted payload.
//   - Ordered restore: entries are applied in the documented restoration
//     order (identity → policy → relay/job state → object storage) so
//     dependent records exist before they are referenced.
//   - No plaintext: keys are fingerprinted in the manifest; values never
//     leave the AEAD-sealed payload, and no secret/plaintext is echoed to
//     reports.
// ---------------------------------------------------------------------------

import { fromBase64, toBase64 } from "@/services/crypto/codec";
import {
  backupKeyId,
  deriveBackupKey,
  digestValue,
  openBackupPayload,
  sealBackupPayload,
} from "./encryption";
import type {
  BackupArchive,
  BackupArchiveHeader,
  BackupCreateReport,
  BackupEntry,
  BackupManifest,
  BackupManifestEntry,
  BackupPayload,
  BackupRestoreReport,
  BackupRunOptions,
  BackupStorage,
  BackupVerifyReport,
} from "./types";
import { BACKUP_ARCHIVE_VERSION, BACKUP_FORMAT } from "./types";

export const GENERATED_BY = "stealth-backup/1";

/**
 * Restore stage order — identities first, then policy, then relay/job state,
 * then object storage. Prefixes are ordered so the earliest matching stage
 * wins for a given key.
 */
const RESTORE_STAGES: ReadonlyArray<{ stage: number; prefixes: string[] }> = [
  // 1. Identity, sessions, credentials, provisioning, verification, wallets.
  {
    stage: 1,
    prefixes: [
      "user:id:",
      "user:email:",
      "user:username:",
      "user:address:",
      "session:",
      "session:user:",
      "retired-session:",
      "credential:",
      "profile:",
      "provisioning:",
      "verification-token:hash:",
      "verification-token:active:",
      "username-reservation:",
      "wallet:",
      "policy-init:",
    ],
  },
  // 2. Mailbox policy, sender rules, contacts, key directory.
  {
    stage: 2,
    prefixes: [
      "policy:",
      "policy-write:",
      "sender-rule:",
      "contacts:",
      "key-directory:",
      "keys:",
      "external-wallet:",
      "external-wallet-address:",
      "wallet-challenge:",
    ],
  },
  // 3. Relay metadata, message records, and job state.
  {
    stage: 3,
    prefixes: [
      "relay:",
      "envelope:",
      "postage:",
      "receipt:",
      "sender-request:",
      "idempotency:",
      "counter:",
    ],
  },
  // 4. Object storage payloads.
  { stage: 4, prefixes: ["staged/", "envelopes/", "attachments/"] },
];

function restoreStage(store: string, key: string): number {
  if (store === "r2") return 4;
  for (const group of RESTORE_STAGES) {
    if (group.stage === 4) continue;
    for (const prefix of group.prefixes) {
      if (key.startsWith(prefix)) return group.stage;
    }
  }
  // Unclassified keys restore last.
  return 99;
}

function fingerprintKey(key: string): string {
  const lastColon = key.lastIndexOf(":");
  const prefix = lastColon >= 0 ? key.slice(0, lastColon + 1) : key.slice(0, 8);
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}…(${(hash >>> 0).toString(16).padStart(8, "0")})`;
}

async function readStore(storage: BackupStorage, errors: string[]): Promise<BackupEntry[]> {
  const entries: BackupEntry[] = [];
  const keys = await storage.listKeys();
  for (const key of keys) {
    const value = await storage.get(key);
    if (!value) {
      errors.push(`missing value for ${fingerprintKey(key)}`);
      continue;
    }
    entries.push({ store: storage.store, key, encoding: value.encoding, value: value.bytes });
  }
  return entries;
}

async function buildManifest(entries: BackupEntry[], createdAt: string): Promise<BackupManifest> {
  const perStore = new Map<string, { count: number; byteLength: number }>();
  const manifestEntries: BackupManifest["entries"] = [];
  for (const entry of entries) {
    const digest = await digestValue(entry.value);
    manifestEntries.push({
      store: entry.store,
      key: fingerprintKey(entry.key),
      digest,
      byteLength: entry.value.byteLength,
    });
    const bucket = perStore.get(entry.store) ?? { count: 0, byteLength: 0 };
    bucket.count += 1;
    bucket.byteLength += entry.value.byteLength;
    perStore.set(entry.store, bucket);
  }
  return {
    version: 1,
    createdAt,
    stores: [...perStore.entries()].map(([store, data]) => ({
      store: store as BackupEntry["store"],
      count: data.count,
      byteLength: data.byteLength,
    })),
    entries: manifestEntries,
  };
}

/**
 * Creates an encrypted, integrity-checked backup from the given stores.
 * The returned archive's ciphertext contains the manifest + all entries.
 */
export async function createBackup(
  storages: BackupStorage[],
  base64Key: string,
  options: BackupRunOptions = {},
): Promise<BackupCreateReport> {
  const startedAt = Date.now();
  const errors: string[] = [];
  const selected = options.stores
    ? storages.filter((s) => options.stores!.includes(s.store))
    : storages;

  const entries: BackupEntry[] = [];
  for (const storage of selected) {
    entries.push(...(await readStore(storage, errors)));
  }

  const createdAt = new Date().toISOString();
  const manifest = await buildManifest(entries, createdAt);
  const header: BackupArchiveHeader = {
    format: BACKUP_FORMAT,
    version: BACKUP_ARCHIVE_VERSION,
    createdAt,
    generatedBy: GENERATED_BY,
    source: options.source ?? "local-emulation",
    encryption: {
      cipher: "AES-256-GCM",
      kdf: "HKDF-SHA256",
      kdfPurpose: "stealth-backup-v1",
      keyId: await backupKeyId(base64Key),
    },
  };

  const key = await deriveBackupKey(base64Key);
  const payload = {
    manifest,
    entries: entries.map((e) => ({
      store: e.store,
      key: e.key,
      encoding: e.encoding,
      value: toBase64(e.value),
    })),
  };
  const sealed = await sealBackupPayload(key, header, payload);
  const archive: BackupArchive = { ...sealed.header, ...sealed };

  return {
    command: "create",
    generatedAt: new Date().toISOString(),
    createdAt,
    ok: errors.length === 0,
    archive,
    stores: manifest.stores,
    durationMs: Date.now() - startedAt,
    errors,
  };
}

/**
 * Verifies an archive: authenticates the AEAD seal (fails closed on tampering
 * or a wrong key) and recomputes every entry digest against the manifest.
 */
export async function verifyBackup(
  archive: BackupArchive,
  base64Key: string,
): Promise<BackupVerifyReport> {
  const errors: string[] = [];
  const key = await deriveBackupKey(base64Key);
  let payload: BackupPayload | undefined;
  try {
    payload = await openBackupPayload(key, archive);
  } catch (error) {
    return {
      command: "verify",
      generatedAt: new Date().toISOString(),
      ok: false,
      verified: 0,
      mismatches: 0,
      errors: ["backup archive authentication failed (tampered or wrong key)"],
    };
  }

  let mismatches = 0;
  const manifestByFingerprint = new Map<string, BackupManifestEntry>(
    payload.manifest.entries.map((e) => [e.key, e]),
  );
  for (const entry of payload.entries) {
    const digest = await digestValue(fromBase64(entry.value));
    const expected = manifestByFingerprint.get(fingerprintKey(entry.key));
    if (!expected || expected.digest !== digest) {
      mismatches += 1;
      errors.push(`digest mismatch for ${fingerprintKey(entry.key)}`);
    }
  }

  return {
    command: "verify",
    generatedAt: new Date().toISOString(),
    ok: mismatches === 0,
    verified: payload.entries.length,
    mismatches,
    errors,
  };
}

/**
 * Restores an archive: verifies first (failing closed), then writes entries
 * back in the documented restoration order. When `wipeFirst` is set each
 * target store is emptied before restore (isolated rehearsal mode).
 */
export async function restoreBackup(
  archive: BackupArchive,
  base64Key: string,
  storages: BackupStorage[],
  options: BackupRunOptions = {},
): Promise<BackupRestoreReport> {
  const startedAt = Date.now();
  const errors: string[] = [];
  const key = await deriveBackupKey(base64Key);
  let payload: BackupPayload | undefined;
  try {
    payload = await openBackupPayload(key, archive);
  } catch {
    return {
      command: "restore",
      generatedAt: new Date().toISOString(),
      ok: false,
      restored: 0,
      stores: [],
      durationMs: Date.now() - startedAt,
      errors: ["backup archive authentication failed (tampered or wrong key)"],
    };
  }

  const byStore = new Map<BackupStorage["store"], BackupStorage>();
  for (const storage of storages) byStore.set(storage.store, storage);

  const selectedStores = options.stores
    ? options.stores.filter((s) => byStore.has(s))
    : [...byStore.keys()];

  if (options.wipeFirst) {
    for (const store of selectedStores) {
      const target = byStore.get(store)!;
      for (const key of await target.listKeys()) {
        await target.delete(key);
      }
    }
  }

  const entries = payload.entries
    .map((e) => ({
      store: e.store,
      key: e.key,
      encoding: e.encoding,
      value: fromBase64(e.value),
    }))
    .filter((e) => selectedStores.includes(e.store))
    .sort((a, b) => {
      const stageDiff = restoreStage(a.store, a.key) - restoreStage(b.store, b.key);
      if (stageDiff !== 0) return stageDiff;
      if (a.store !== b.store) return a.store < b.store ? -1 : 1;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });

  const perStore = new Map<string, { count: number; byteLength: number }>();
  for (const entry of entries) {
    const target = byStore.get(entry.store);
    if (!target) {
      errors.push(`no storage bound for ${entry.store}`);
      continue;
    }
    await target.put(entry.key, { encoding: entry.encoding, bytes: entry.value });
    const bucket = perStore.get(entry.store) ?? { count: 0, byteLength: 0 };
    bucket.count += 1;
    bucket.byteLength += entry.value.byteLength;
    perStore.set(entry.store, bucket);
  }

  return {
    command: "restore",
    generatedAt: new Date().toISOString(),
    ok: errors.length === 0,
    restored: entries.length,
    stores: [...perStore.entries()].map(([store, data]) => ({
      store: store as BackupStorage["store"],
      count: data.count,
      byteLength: data.byteLength,
    })),
    durationMs: Date.now() - startedAt,
    errors,
  };
}
