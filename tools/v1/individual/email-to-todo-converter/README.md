# Email-to-Todo Converter

Email-to-Todo Converter is an isolated V1 individual tool for proposing todos from email metadata and message content. It is not wired into the main mail app yet; this folder captures the review surface for the tool until a future integration issue connects it.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/email-to-todo-converter/
```

Do not modify the main application shell, routing, inbox architecture, wallet core, Stellar integration, database schema, or shared design system from this issue.

## Review Map

- `specs.md` defines the expected input, output, decision rules, and open questions.
- `fixtures/email-todo-cases.json` provides representative emails and expected todos.
- `tests/test-plan.md` lists the folder-local validation scenarios for future code.
- `docs/review-notes.md` gives maintainers a short checklist for reviewing this tool independently from the main application.

## Intended Behavior

The tool inspects an email (subject, sender, snippet, body preview) and proposes one or more candidate todos with task text, confidence, and evidence.

Extraction method (manual selection, automatic background parse, or LLM-assisted) is explicitly UNDECIDED.

## Known Limitations

- No production model, service, hook, or UI component is implemented in this issue.
- Extraction strategy is undecided.
- Storage destination is undecided (see specs.md open questions).
- The test plan is fixture-backed documentation because the tool has no executable implementation yet.
- Future implementation work must avoid sending message content outside the user-controlled execution boundary.
