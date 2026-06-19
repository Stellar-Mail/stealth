# Review Notes

This contribution prepares the Email-to-Todo Converter tool for independent review before implementation work starts.

## What To Review

- The tool boundary is explicit and limited to this folder.
- Fixtures include clear-action, meeting, multi-item, no-action, and ambiguous examples.
- The test plan documents privacy, confidence, and cardinality rules.
- Open questions are explicitly listed and left unresolved.

## What Is Intentionally Not Included

- No app route, navigation item, database migration, wallet integration, or shared design system change.
- No extraction strategy decided (manual, automatic, or LLM-assisted).
- No storage integration.
- No model call or external API.
- No executable test harness until the first service/hook implementation is introduced.

## Follow-Up Implementation Shape

A future implementation can add:

- `services/extractTodos.ts` for deterministic todo extraction.
- `tests/extractTodos.test.ts` using the fixture file in this folder.
- A local demo component only if a future UI issue asks for it.
