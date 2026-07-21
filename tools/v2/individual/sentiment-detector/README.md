# Sentiment Detector

This folder is the isolated workspace for the Sentiment Detector tool. It
analyzes sender sentiment from a message's subject and body and returns a
typed, deterministic result.

## Execution contract

The non-UI entry point is exported from `index.ts`:

```ts
import { safeAnalyzeSentiment } from "tools/v2/individual/sentiment-detector";

const outcome = safeAnalyzeSentiment({
  messageId: "msg-1",
  subject: "Great news",
  body: "Really appreciate the quick fix!",
});

if (outcome.status === "ok") {
  outcome.result.sentiment; // "positive" | "negative" | "neutral" | "mixed"
}
```

- `safeAnalyzeSentiment` — guarded entry point for untrusted input; validates,
  sanitizes, enforces limits, and never throws.
- `analyzeSentiment` — pure engine for pre-validated input.
- Full contract (types, error codes, scoring model): `docs/contract.md`.
- Fixtures for success and failure paths: `services/fixtures.ts`.

## Layout

- `index.ts` — public barrel export (no UI code)
- `types/` — typed input/output contract and error codes
- `services/` — detection engine, guards, fixtures
- `tests/` — vitest suites for the engine and guards
- `docs/` — contract documentation

## Testing

From the repository root:

```sh
npx vitest run --config tools/v2/individual/sentiment-detector/vitest.config.ts
```

## Ownership Boundary

All work for this tool must stay inside:

`tools/v2/individual/sentiment-detector/`

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or existing design system unless a future
integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations.
