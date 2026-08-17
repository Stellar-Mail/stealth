# Storage Services

Off-chain encrypted payload storage adapters, cache handling, and attachment storage.

## Encrypted Object Storage (R2, BETA-030 / #1937)

`r2-adapter.ts` provides a Cloudflare R2-backed object store for large encrypted
payloads (envelope bodies and attachment chunks) that KV and Durable Objects
cannot hold. The domain contract and integrity rules live in `object-store.ts`:

- **Deterministic, content-addressed keys** — a SHA-256 commitment digest, never
  an original filename, so no sensitive metadata leaks through the key space.
- **Staged-then-finalized writes** — content length, SHA-256 commitment, media
  metadata, and ownership are all verified before an object becomes readable.
- **Verified reads** — every download re-checks the SHA-256 commitment, so
  corrupted bytes are refused rather than served.
- **Orphan cleanup** — partial uploads and abandoned staged objects expire and
  are swept by `cleanupExpired()`.

The relay facade lives in `src/services/relay/object-store.ts`. `r2-fake.ts` is
an in-memory bucket used by local tests; see `docs/deployment/R2.md` for the
production setup.

## Outbox

`outbox.ts` persists outbound messages and delivery state in `localStorage` so
an in-flight send survives a page refresh. Only the encrypted envelope and
delivery metadata are persisted; plaintext is never written here.
