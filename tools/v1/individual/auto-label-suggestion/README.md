# Auto Label Suggestion

Auto Label Suggestion is an isolated V1 individual tool for proposing labels from email
metadata and message content. It is not wired into the main mail app yet; this folder
captures the review surface for the tool until a future integration issue connects it.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/auto-label-suggestion/
```

Do not modify the main application shell, routing, inbox architecture, wallet core,
Stellar integration, database schema, or shared design system from this issue.

## Review Map

- `specs.md` defines the expected input, output, label taxonomy, and decision rules.
- `fixtures/email-label-cases.json` provides representative emails and expected labels.
- `tests/test-plan.md` lists the folder-local validation scenarios for future code.
- `docs/review-notes.md` gives maintainers a short checklist for reviewing this tool
  independently from the main application.

## Intended Behavior

The tool should inspect an email subject, sender, snippet, body preview, and existing
labels, then return ranked label suggestions. A suggestion should include a label,
confidence level, reason, and short evidence string so the user can understand why the
label was proposed.

## Known Limitations

- No production model, service, hook, or UI component is implemented in this issue.
- The test plan is fixture-backed documentation because the tool has no executable
  implementation yet.
- Future implementation work should keep confidence thresholds configurable and avoid
  sending message content outside the user-controlled execution boundary.
