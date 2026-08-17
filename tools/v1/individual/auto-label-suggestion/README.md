# Auto Label Suggestion

Auto Label Suggestion is an isolated V1 individual tool for proposing labels from email
metadata and message content. It is not wired into the main mail app; this folder is the
complete review surface until a future integration issue connects it.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/auto-label-suggestion/
```

Do not modify the main application shell, routing, inbox architecture, wallet core,
Stellar integration, database schema, or shared design system from this issue.

## Folder-Local API

Import from this folder only:

```ts
import { suggestAutoLabels, validateAutoLabelEmail } from "./index";
```

### Inputs

`suggestAutoLabels(input)` accepts an `AutoLabelEmail`:

- `id`, `from`, `subject`, and `snippet` are required strings.
- `bodyPreview`, `existingLabels`, and `receivedAt` are optional.
- `receivedAt`, when present, must parse as an ISO-compatible date.

### Outputs

The service returns a deterministic `AutoLabelResult`:

- `status: "success"` with at most three ranked `suggestions`.
- `status: "error"` with an empty `suggestions` array and `validationErrors`.
- `preservedExistingLabels` always echoes user labels separately from suggestions.
- `source: "local-deterministic-rules"` documents that no live network calls or models are used.

### Loading and error states

The exported `AutoLabelStatus` type documents `"idle" | "loading" | "success" | "error"`
for future UI work. The core service is synchronous, so it only returns `success` or
`error`; a future hook can map pending UI work to `idle` and `loading` without changing
the service contract.

## Review Map

- `services.ts` contains the deterministic folder-local label engine.
- `types.ts` contains the folder-local API types.
- `services.test.ts` validates the taxonomy, fixtures, validation states, and ranking.
- `fixtures/email-label-cases.json` provides representative emails and expected labels.
- `tests/test-plan.md` lists folder-local validation scenarios.
- `docs/review-notes.md` gives maintainers a checklist for reviewing this tool independently.

## Intended Behavior

The tool inspects an email subject, sender, snippet, body preview, and existing labels,
then returns ranked label suggestions. A suggestion includes a label, confidence level,
reason, and short evidence string so the user can understand why the label was proposed.

## Known Limitations

- This is not integrated into the production inbox, routes, or app shell.
- The deterministic engine uses local rules and fixtures only; it does not call live
  services, models, secrets, or production data.
- Future implementation work should keep confidence thresholds configurable and avoid
  sending message content outside the user-controlled execution boundary.
