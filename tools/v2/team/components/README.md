# Components

This folder is the isolated workspace for the Components tool — a
presentation-free component registry that resolves and validates reusable UI
components by id, independent of any rendering layer.

## Ownership Boundary

All work for this tool must stay inside:
`tools/v2/team/components/`

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, or design system unless a future integration issue
explicitly allows it.

## Non-UI execution contract

The component logic exposes a presentation-free execution contract so it can run
as a backend service, independent of any UI.

- `types.ts` — domain types: `ComponentDefinition`, `ComponentDescriptor`,
  `ResolveComponentInput`.
- `contract.ts` — the typed `ComponentOperation` / `ComponentContractOutput`, the
  `ComponentResult<T>` discriminated union, explicit `ComponentErrorCode` values,
  a pure `ComponentRegistry`, and `createComponentsContract(defs)`.
- `services/components.service.ts` — `createComponentsService(defs)` is the
  service entry point; its `execute(...)` returns typed success/error results
  instead of throwing.
- `fixtures.ts` — deterministic sample component definitions (button, modal, a
  disabled legacy-banner).
- `tests/contract.test.ts` — vitest coverage of resolve-by-id, prop validation,
  list, and the unknown-id / unknown-prop / missing-id error paths.

Usage:

```ts
import { createComponentsService } from ".";

const contract = createComponentsService([
  { id: "button", name: "Button", props: { label: "string" } },
]);
const res = contract.execute({ operation: "resolve", input: { id: "button" } });
if (res.ok && res.value.operation === "resolve") {
  // res.value.descriptor has id/name/props/enabled
} else {
  // res.error is a ComponentErrorCode
}
```
