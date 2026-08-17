# Readability Improver

This folder is the isolated workspace for the Readability Improver tool. It
analyzes a message's subject and body, scores reading ease, and returns
typed, deterministic improvement suggestions.

## Execution contract

The non-UI entry point is exported from `index.ts`:

```ts
import { safeImproveReadability } from "tools/v2/individual/readability-improver";

const outcome = safeImproveReadability({
  messageId: "msg-1",
  subject: "Process update",
  body: "We will utilize the new workflow to facilitate onboarding.",
});

if (outcome.status === "ok") {
  outcome.result.score; // Flesch reading ease, 0–100
  outcome.result.issues; // typed findings with suggestions
}
```

- `safeImproveReadability` — guarded entry point for untrusted input;
  validates, sanitizes, enforces limits, and never throws.
- `improveReadability` — pure engine for pre-validated input.
- Full contract (types, error codes, analysis rules): `docs/contract.md`.
- Fixtures for success and failure paths: `services/fixtures.ts`.

## Layout

- `index.ts` — public barrel export (no UI code)
- `types/` — typed input/output contract and error codes
- `services/` — analysis engine, guards, fixtures
- `tests/` — vitest suites for the engine and guards
- `docs/` — architecture and contract documentation
- `components/`, `hooks/` — reserved for future UI work (untouched here)

## Testing

From the repository root:

```sh
npx vitest run --config tools/v2/individual/readability-improver/vitest.config.ts
```

## Ownership Boundary

All work for this tool must stay inside:

`tools/v2/individual/readability-improver/`

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or existing design system unless a future
integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations, and
docs/ARCHITECTURE.md for module boundaries.
