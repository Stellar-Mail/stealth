# Schema Migrations and Rollback

Moving from memory storage to durable storage introduces schema evolution. This document outlines how schema versioning, forward migrations, and rollbacks are handled for the API repository layer.

## Schema Versioning

All persisted records in the system (e.g., `mailboxPolicy`, `postage`, `receipt`, `user`, `profile`, `credential`) are wrapped in an envelope containing a schema version:

```json
{
  "$v": 1,
  "data": { ... }
}
```

The system ensures that any unversioned records from legacy memory storage are implicitly treated as `$v: 1`.

### User Account, Profile & Credential Schemas (BETA-002)

With BETA-002, three core identity and access schemas are registered at version `$v: 1`:

- **`user` ($v: 1)**: Represents the core account record (`userId`, `address`, `email`, `username`, `status`, `createdAt`, `updatedAt`, `version`). User updates rely on `version` for optimistic concurrency control to prevent lost updates under race conditions.
- **`profile` ($v: 1)**: Stores public profile metadata (`userId`, `username`, `displayName`, `avatarUrl`, `bio`, `createdAt`, `updatedAt`).
- **`credential` ($v: 1)**: Stores private authentication secrets (`credentialId`, `userId`, `authMethod`, `secretHash`, `walletKeyRef`, `createdAt`, `updatedAt`). Stored separately and strictly isolated from public user and profile projections (`toPublicUser`, `toPublicProfile`).

### Secondary Indexes & Uniqueness Constraints

To guarantee unique `email`, `username`, and `address` lookups across durability layers:

1. **Unique Secondary Indexes**: Secondary index lookup keys (`user:email:<email>`, `user:username:<username>`, `user:address:<address>`) point to the primary `userId`.
2. **Atomic Writes**: `createUser` and `updateUser` operations validate index uniqueness within an atomic lock or Durable Object transaction, throwing a deterministic `ApiError(409, "conflict")` if any index is already bound.
3. **Index Cleanup on Mutation**: When a user's `email`, `username`, or `address` is updated, the previous index keys are automatically deleted in the same atomic transaction.

## Forward Migrations

Migrations are deterministic and handled "on-read" (lazy migration). When a record is fetched from the durable storage, the repository layer checks its `$v` attribute against the current version defined in code.

If the stored version is older than the current version, the system sequentially applies the necessary migrations from the record's version up to the current version. The migrated record is then validated against the current Zod schema.

When the record is subsequently written back to storage, it is written with the current schema version.

## Migration Order and Deployment

When introducing a new schema version, you must:

1. **Update the Zod Schema**: Modify the schema in `src/server/api/domain.ts`.
2. **Define the Migration**: Add a transformation function mapping the previous version (N-1) to the new version (N).
3. **Register the Migration**: Provide the migration and increment the `currentVersion` when calling `registerRecordSchema` in `src/server/api/context.ts`.
4. **Write Tests**: Add deterministic tests in `tests/unit/api/migrations.test.ts` verifying that a fixture of the old schema correctly migrates to the new schema.

### Deployment Order

1. **Deploy New Code**: Roll out the new code containing the migration logic.
2. **On-Read Migration**: As records are accessed, they are automatically migrated to the new schema.

## Rollback Guidance

If you need to roll back a deployment that introduced a schema migration, the following constraints apply:

- **Unsupported Newer Schemas**: If the older code encounters a record written with a newer schema version (which can happen if a record was written by the new code before rollback), it will fail safely and throw a `DataIntegrityError`. The older code **will not** attempt to read or corrupt the newer schema.
- **Rollback Procedure**: To fully roll back after records have been written in the new schema:
  1. Re-deploy the older codebase.
  2. Any records written in the newer schema will be inaccessible until they are either manually downgraded in the storage layer or the newer code is successfully rolled forward again.
  3. Avoid writing breaking schema changes unless necessary. For additive changes, consider keeping them backward-compatible (e.g., using `z.optional()`) rather than bumping the schema version, as this minimizes the risk of `DataIntegrityError` upon rollback.

---

## Versioned Cloudflare Persistence Bindings & Identity Migrations (BETA-024 / Issue #1931)

BETA-024 adds deployable schema governance for the durable identity records
persisted by the `StealthCoordinator` Durable Object. It introduces:

1. **Environment-scoped Cloudflare bindings** (`preview`, `production`) with
   **no real resource IDs committed** — the committed `wrangler.jsonc` ships
   `{VAR_NAME}` placeholder tokens that a generator injects at deploy time.
2. **A versioned migration engine** over the identity record families
   (users, sessions, usernames, verification, wallet metadata) with `dry-run`,
   `forward`, `rollback`, and `integrity-check` commands.
3. **Local Cloudflare emulation tests** so every command is verified against
   Miniflare before it is ever run against real storage.

### Persistence Bindings & Config Generation

The committed `wrangler.jsonc` defines top-level (local dev) plus `env.preview`
and `env.production` sections. Every KV namespace ID is a placeholder such as
`{STEALTH_KV_PRODUCTION_ID}`; real IDs and secret values are **never** committed.

```bash
# Provide the real KV namespace IDs (see .env.example) and generate:
bun run config:generate        # writes .wrangler/generated/wrangler.jsonc
bun run config:check           # CI-safe: validates the committed config only

# Deploy with the generated config:
wrangler deploy --env production --config .wrangler/generated/wrangler.jsonc
```

Guards enforced by `validateCommittedConfig` / `validateResolvedConfig`
(`src/server/migrations/wrangler-config-guard.ts`):

- No 32-hex-char real resource IDs and no secret values may appear in the
  committed config.
- `preview` and `production` must resolve to **distinct** KV namespaces, so the
  two environments can never share storage accidentally.
- Both named environments must declare their Durable Object binding and their
  `secrets.required` list (currently `STEALTH_CURSOR_SECRET`).

### Identity Record Families

| Family            | Key prefix         | Schema source                                |
| :---------------- | :----------------- | :------------------------------------------- |
| `user`            | `user:id:`         | `userSchema` (`src/server/api/domain.ts`)    |
| `session`         | `session:`         | `sessionSchema` (`src/server/api/domain.ts`) |
| `username`        | `user:username:`   | username index (userId string)               |
| `verification`    | `verification:`    | `verificationSchema` (BETA-024)              |
| `wallet-metadata` | `wallet:metadata:` | `walletMetadataSchema` (BETA-024)            |

All five families are governed at `$v: 1` today. Records follow the same
`{ $v, ...payload }` envelope convention as the repository layer; legacy
unversioned records are implicitly `$v: 1`.

The `user` family declares its email/address secondary indexes; integrity
checks verify each index exists (`missing_index`), points back
(`index_mismatch`), and that every `user:username:` entry still targets a live
user (`dangling_index`).

### Migration Commands (CLI)

The commands run the engine against a **local Miniflare emulation** of the
Durable Object storage. State persists under `.wrangler/state/migrations`, so
`forward`/`rollback` are restartable across invocations and operate on the same
emulated store.

```bash
bun run migrations:dry-run            # report forward-pending counts, no writes
bun run migrations:forward            # apply pending forward migrations
bun run migrations:rollback -- --target-version 1 [--family session]
bun run migrations:integrity-check    # schema/index integrity report
```

Optional flags: `--family <user|session|username|verification|wallet-metadata>`
restricts a run to a single family; `rollback` requires `--target-version`.

Engine contract (`src/server/migrations/runner.ts`):

- **Restartable**: a successful run leaves every record at the target version;
  re-running it reports `0 changed`, `0 failed`.
- **Exact counts**: each family report carries `totalKeys`, `forwardPending`,
  `changed`, `skipped`, and `failed`.
- **No sensitive payloads**: record values and full index keys (which can
  contain emails/usernames) are never echoed — reports reference only a
  namespace prefix plus a digest fingerprint.

### Production Invocation

A separate migration worker **cannot** share Durable Object storage with the
app worker, so the engine also runs in-process on the real coordinator via
`StealthCoordinator.runIdentityMigrations(command, options)`
(`src/server/api/stealth-coordinator.ts`). Operators invoke it on the
production DO instance; wiring an authenticated admin route is a follow-up.

### Adding a New Record Version

1. Bump `currentVersion` for the family in
   `src/server/migrations/adapters.ts`.
2. Add the forward transform keyed by the **source** version (e.g. `2:` maps
   `v1 -> v2`) and, for rollback support, the backward transform keyed by the
   version being reverted from.
3. Add deterministic tests in `tests/unit/migrations/runner.test.ts` covering
   forward, restartability, and rollback; extend the Miniflare test
   (`tests/unit/migrations/miniflare.test.ts`) with a migrated fixture.
