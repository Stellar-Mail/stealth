import type { IdentityRecordFamily } from "./types";

// ---------------------------------------------------------------------------
// Versioned-record envelope helpers (BETA-024 / Issue #1931).
//
// Persisted records carry a `$v` marker alongside their payload — the same
// envelope convention the API repository layer uses (see
// `registerRecordSchema` / `validateRecord` in `src/server/api/repository.ts`).
// Records that predate versioning are treated as `$v: 1`, matching the
// repository's "legacy records are implicitly version 1" rule.
// ---------------------------------------------------------------------------

export function readEnvelope(raw: unknown): {
  version: number;
  payload: Record<string, unknown>;
} {
  if (typeof raw === "object" && raw !== null) {
    const record = raw as Record<string, unknown>;
    if (typeof record.$v === "number" && Number.isInteger(record.$v) && record.$v >= 1) {
      const { $v, ...payload } = record;
      return { version: $v, payload };
    }
  }
  // Legacy / unversioned record: implicit version 1.
  return { version: 1, payload: (raw as Record<string, unknown>) ?? {} };
}

export function wrapEnvelope(payload: Record<string, unknown>, version: number): unknown {
  return { ...payload, $v: version };
}

/**
 * Applies forward migrations from a record's stored version up to the family's
 * current version. Returns the migrated envelope (with the new `$v`) or `null`
 * when a required forward step is missing (caller treats this as a failure and
 * leaves the record untouched).
 */
export function applyForward(
  family: IdentityRecordFamily,
  raw: unknown,
): { record: unknown; fromVersion: number; toVersion: number } | null {
  const { version, payload } = readEnvelope(raw);
  let current = payload;
  for (let v = version; v < family.currentVersion; v++) {
    const step = family.forward[v];
    if (!step) return null;
    current = step(current);
    if (typeof current !== "object" || current === null) return null;
  }
  return {
    record: wrapEnvelope(current, family.currentVersion),
    fromVersion: version,
    toVersion: family.currentVersion,
  };
}

/**
 * Applies backward migrations from a record's stored version down to
 * `targetVersion` (which must be >= 1 and < the stored version). Returns the
 * reverted envelope or `null` when a required backward step is missing.
 */
export function applyBackward(
  family: IdentityRecordFamily,
  raw: unknown,
  targetVersion: number,
): { record: unknown; fromVersion: number; toVersion: number } | null {
  if (!Number.isInteger(targetVersion) || targetVersion < 1) return null;
  const { version, payload } = readEnvelope(raw);
  if (version <= targetVersion) return null;
  let current = payload;
  for (let v = version; v > targetVersion; v--) {
    const step = family.backward[v];
    if (!step) return null;
    current = step(current);
    if (typeof current !== "object" || current === null) return null;
  }
  return {
    record: wrapEnvelope(current, targetVersion),
    fromVersion: version,
    toVersion: targetVersion,
  };
}

/**
 * Returns a redacted, traceable representation of a storage key for reports:
 * the namespace prefix plus a short digest of the full key. The full key can
 * contain usernames or email addresses (secondary indexes), so it is never
 * echoed verbatim.
 */
/**
 * Returns a redacted, traceable representation of a storage key for reports:
 * only the namespace prefix (up to the last `:`) plus a short digest of the
 * full key. The value portion — which can contain usernames or email
 * addresses in secondary indexes — is never echoed.
 */
export function fingerprintKey(key: string): string {
  const lastColon = key.lastIndexOf(":");
  const prefix = lastColon >= 0 ? key.slice(0, lastColon + 1) : key.slice(0, 8);
  return `${prefix}…(${digestKey(key)})`;
}

/**
 * Deterministic, dependency-free key fingerprint used only for redaction in
 * reports. This is a FNV-1a + linear hash, NOT a cryptographic hash — it
 * merely keeps email/usernames embedded in index keys out of operator logs.
 */
export function digestKey(value: string): string {
  let fnv = 0x811c9dc5;
  let lin = 0x01000193;
  for (let i = 0; i < value.length; i++) {
    fnv ^= value.charCodeAt(i);
    fnv = Math.imul(fnv, 0x01000193);
    lin = (lin * 31 + value.charCodeAt(i)) | 0;
  }
  return (fnv >>> 0).toString(16).padStart(8, "0") + (lin >>> 0).toString(16).padStart(8, "0");
}

/** Deterministic redacted checksum for migration evidence and drift checks. */
export function checksumValue(value: unknown): string {
  return digestKey(JSON.stringify(value) ?? "undefined");
}
