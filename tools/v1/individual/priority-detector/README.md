# Priority Detector

V1 individual tool workspace for classifying email priority signals into a
reviewable, user-controlled result.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/priority-detector/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Intended Use

- Inspect normalized subject, body, sender metadata, and optional timestamps.
- Produce a priority label that helps a user triage messages.
- Explain which signals contributed to the label.
- Keep the result advisory; the detector must not move, archive, delete, or send
  mail.

## Priority Labels

- `urgent`: likely time-sensitive and action-oriented.
- `high`: important but not immediate.
- `normal`: ordinary message with no strong urgency signal.
- `low`: low-action or FYI-style message.
- `unknown`: insufficient content or conflicting signals.

## Testing Focus

Use `docs/test-plan.md` and `docs/fixtures.md` to cover deadline language,
sender context, conflicting urgency copy, newsletters, FYI messages, empty
content, and explainability requirements.
