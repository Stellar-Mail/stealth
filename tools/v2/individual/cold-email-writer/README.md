# Cold Email Writer

Cold Email Writer exposes a deterministic, non-UI service for producing a
plain-text outbound email draft from structured campaign data.

## Backend entry point

Import `safeWriteColdEmail` from `index.ts` when handling untrusted payloads.
It validates and sanitizes input, enforces size limits, and returns a
discriminated result without throwing. Call `writeColdEmail` only when the
payload has already been validated.

The complete typed contract and service boundaries are documented in
`docs/contract.md`. Typed success and failure examples are exported from
`services/fixtures.ts`.

## Local verification

```sh
npx vitest run tools/v2/individual/cold-email-writer/tests
npx tsc --noEmit
```

## Ownership boundary

All code, tests, fixtures, and documentation for this tool stay inside this
folder. The module has no UI, routing, mailbox, database, or design-system
dependencies.
