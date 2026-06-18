# Review Notes

This contribution prepares the Auto Label Suggestion tool for independent review before
implementation work starts.

## What To Review

- The tool boundary is explicit and limited to this folder.
- The taxonomy covers the first practical labels for an individual inbox.
- Fixtures include positive, mixed, and low-risk examples.
- The test plan documents privacy and prioritization edge cases.

## What Is Intentionally Not Included

- No app route, navigation item, database migration, wallet integration, or shared design
  system change.
- No model call, external API, background job, or analytics event.
- No executable test harness until the first service/hook implementation is introduced.

## Follow-Up Implementation Shape

A future implementation can add:

- `services/suggestLabels.ts` for deterministic label ranking.
- `tests/suggestLabels.test.ts` using the fixture file in this folder.
- A local demo component only if a future UI issue asks for it.
