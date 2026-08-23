import type { ZodType } from "zod";

// ---------------------------------------------------------------------------
// BETA-024 (Issue #1931) — deployable schema governance for identity records.
//
// The migration tooling in this module gives release operators dry-run,
// forward, rollback and integrity-check commands over the versioned identity
// records (users, sessions, usernames, verification, wallet metadata) stored
// in Cloudflare Durable Object / KV storage. All reporting is count-based and
// deliberately redacted: record payloads (and email/usernames used as index
// keys) are never echoed to logs or reports.
// ---------------------------------------------------------------------------

/**
 * A narrow, storage-agnostic key/value surface the migration engine needs.
 * `listKeys` returns every key under `prefix`; `get`/`put`/`delete` are the
 * usual CRUD primitives. Both the Durable Object storage and the in-memory
 * test backend implement it, so the engine is fully unit-testable and also
 * runs against local Cloudflare emulation.
 */
export interface MigrationStorage {
  listKeys(prefix: string): Promise<string[]>;
  get(key: string): Promise<unknown | null>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * A single record family's schema-governance contract.
 *
 * - `keyPrefix` is the canonical record namespace (e.g. `user:id:`).
 * - `indexPrefixes` are the secondary-index namespaces that point at this
 *   family's canonical records (e.g. `user:email:`), used by integrity checks.
 * - `indexResolvers` derive the secondary-index value stored under each
 *   `indexPrefix` from a canonical record's payload, so integrity checks can
 *   confirm every canonical record has its indexes present and pointing back.
 * - `currentVersion` is the newest schema version this build understands.
 * - `forward` maps `v(n) -> v(n+1)` transform functions keyed by the source
 *   version; `backward` maps `v(n) -> v(n-1)` reversion functions keyed by the
 *   version being reverted from.
 * - `schema` validates a record payload after envelope stripping.
 * - `checkRecord` is an optional family-specific integrity hook (e.g. the
 *   username family verifies its target user still exists).
 */
export interface IdentityRecordFamily {
  name: "user" | "session" | "username" | "verification" | "wallet-metadata";
  keyPrefix: string;
  indexPrefixes: readonly string[];
  indexResolvers?: readonly IndexResolver[];
  currentVersion: number;
  schema: ZodType;
  forward: Record<number, (data: Record<string, unknown>) => Record<string, unknown>>;
  backward: Record<number, (data: Record<string, unknown>) => Record<string, unknown>>;
  /** Optional deployment checks that must pass before a mutating run. */
  preconditions?: (storage: MigrationStorage) => Promise<string[]>;
  checkRecord?: (
    payload: unknown,
    key: string,
    storage: MigrationStorage,
  ) => Promise<IntegrityIssue | null>;
}

export interface IndexResolver {
  prefix: string;
  /** Derives the index value (e.g. the user's email) from a record payload. */
  resolve: (payload: Record<string, unknown>) => string | null;
}

export type MigrationCommand = "dry-run" | "forward" | "rollback" | "integrity-check";

export interface MigrationRunOptions {
  /** Restrict the run to a single record family by name. */
  family?: string;
  /** Rollback target version (rollback command only). */
  targetVersion?: number;
  /** Maximum number of records changed in one invocation. */
  batchSize?: number;
  /** Continue after the last key reported by an earlier batch. */
  resumeAfter?: string;
  /** Explicit operator approval required by mutating coordinator calls. */
  approval?: string;
  /** Expected registry fingerprint from the reviewed migration manifest. */
  expectedRegistryChecksum?: string;
}

export type IntegrityIssueKind =
  | "invalid_record"
  | "unsupported_version"
  | "missing_index"
  | "index_mismatch"
  | "dangling_index"
  | "corrupt_envelope";

export type MigrationFailureKind =
  | "precondition_failed"
  | "rollback_blocked"
  | "compatibility_failed";

export interface IntegrityIssue {
  kind: IntegrityIssueKind;
  /** Truncated, redacted key — never the full value or record payload. */
  key: string;
}

export interface FamilyReport {
  family: string;
  keyPrefix: string;
  totalKeys: number;
  /** Counted by dry-run: records that would be migrated forward. */
  forwardPending: number;
  /** Records successfully migrated forward / rolled back by the run. */
  changed: number;
  /** Records already at the target version (idempotent restarts). */
  skipped: number;
  /** Records that failed to migrate and are left untouched. */
  failed: number;
  /** Redacted failure reasons — never payloads. */
  errors: string[];
  /** Integrity findings (integrity-check command only). */
  issues: IntegrityIssue[];
  /** Stable, redacted fingerprints for audit evidence. */
  beforeChecksum?: string;
  afterChecksum?: string;
  nextCursor?: string;
  resumed?: boolean;
}

export interface MigrationReport {
  command: MigrationCommand;
  generatedAt: string;
  families: FamilyReport[];
  ok: boolean;
  registryChecksum?: string;
  preconditions?: string[];
  failureKind?: MigrationFailureKind;
}
