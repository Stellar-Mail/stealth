# Docs

This folder is the isolated workspace for the Docs tool — a presentation-free
documentation index that resolves and normalizes doc references (by id or path),
independent of any rendering layer.

## Ownership Boundary

All work for this tool must stay inside:
`tools/v2/team/docs/`

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, or design system unless a future integration issue
explicitly allows it.

## Non-UI execution contract

The doc logic exposes a presentation-free execution contract so it can run as a
backend service, independent of any UI.

- `types.ts` — domain types: `DocEntry`, `ResolvedDoc`, `ResolveDocInput`.
- `contract.ts` — the typed `DocOperation` / `DocContractOutput`, the
  `DocResult<T>` discriminated union, explicit `DocErrorCode` values, the pure
  `resolveDoc` reducer (lookup by id, then by path), `toResolvedDoc`, and
  `validateResolveDoc`.
- `services/docs.service.ts` — `createDocsService()` returns a `DocsContract`
  whose `execute(ref, index)` returns typed success/error results instead of
  throwing.
- `fixtures.ts` — deterministic sample doc index (getting-started, api-reference, contributing).
- `tests/contract.test.ts` — vitest coverage of resolve-by-id, resolve-by-path,
  and the unknown-ref / empty-ref / invalid-index error paths.

Usage:

```ts
import { createDocsService } from ".";

const contract = createDocsService();
const res = contract.execute({ operation: "resolve", input: { ref: "doc-api-reference" } }, index);
if (res.ok && res.value.operation === "resolve") {
  // res.value.doc has id/title/path/tags
} else {
  // res.error is a DocErrorCode
}
```
