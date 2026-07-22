# Draft Improver

This folder is the isolated workspace for the Draft Improver tool.

## Ownership Boundary

All work for this tool must stay inside:

`tools/v2/individual/draft-improver/`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Backend execution contract

The service exposes a typed, non-UI contract for backend callers through the public entry point in [index.ts](index.ts).

### Input

- `DraftImproverInput`: stable payload with `messageId`, `subject`, `body`, and optional metadata such as `senderAddress`, `receivedAt`, and `language`.

### Output

- `DraftImproverResult`: normalized `improvedSubject`, `improvedBody`, `score`, `issues`, and `metrics`.
- `SafeDraftImproverResult`: discriminated success/error response for non-throwing callers.

### Error codes

- `invalid-input`
- `invalid-options`
- `input-too-large`
- `empty-content`
- `unsupported-language`

### Service boundaries

- The core logic is implemented in [services/guards.ts](services/guards.ts).
- Fixtures for success and failure scenarios live in [services/fixtures.ts](services/fixtures.ts).
- Tests are in [tests](tests).

## Notes

No styling or layout files are part of this implementation; the work stays within the service and documentation boundaries.

See [specs.md](specs.md) for the issue categories and contributor expectations.
