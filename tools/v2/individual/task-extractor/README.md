# Task Extractor

This folder is the isolated workspace for the Task Extractor tool. It extracts
action items from a message's subject and body and returns a typed,
deterministic result.

## Execution contract

The non-UI entry point is exported from `index.ts`:

```ts
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

const outcome = safeExtractTasks({
  messageId: "msg-1",
  subject: "Sprint prep",
  body: "- [ ] Update the roadmap deck\nPlease send the notes by tomorrow.",
  receivedAt: "2026-07-03T08:00:00.000Z",
});

if (outcome.status === "ok") {
  outcome.result.tasks; // ExtractedTask[] with priority, confidence, due hints
}
```

- `safeExtractTasks` — guarded entry point for untrusted input; validates,
  sanitizes, enforces limits, and never throws.
- `extractTasks` — pure engine for pre-validated input.
- Full contract (types, error codes, extraction rules): `docs/contract.md`.
- Fixtures for success and failure paths: `services/fixtures.ts`.

## Layout

- `index.ts` — public barrel export (no UI code)
- `types/` — typed input/output contract and error codes
- `services/` — extraction engine, guards, fixtures
- `tests/` — vitest suites for the engine and guards
- `docs/` — contract documentation

## Testing

From the repository root:

```sh
npx vitest run --config tools/v2/individual/task-extractor/vitest.config.ts
```

## Ownership Boundary

All work for this tool must stay inside:

`tools/v2/individual/task-extractor/`

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or existing design system unless a future
integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations.
