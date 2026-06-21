# Review Notes

## Issue coverage

Issue #632 asks for safety and performance constraints before future
integration. This change adds that boundary beside the existing Meeting
Assignment Tool engine without wiring it into the app.

## Files added or updated

- `services/meeting-assignment-guards.mjs` adds request normalization, duplicate
  checks, size caps, effort/date validation, and work estimation.
- `tests/meeting-assignment-guards.test.mjs` covers valid normalization,
  malformed requests, duplicate ids, invalid effort, batch caps, work
  estimation, and text cleanup.
- `docs/SAFETY_AND_PERFORMANCE.md` documents assumptions, limits, unsafe input
  categories, and reviewer checks.
- `docs/SECURITY_REVIEW_NOTES.md` maps the implementation to issue #632.
- `README.md` links the guard helper and test command.

## Acceptance criteria mapping

- Explicit handling for malformed or hostile input: invalid top-level payloads,
  malformed members, malformed meetings, duplicate ids, invalid dates, and
  invalid effort values return deterministic errors.
- Avoid unnecessary work on large datasets: team member and meeting arrays are
  capped before pairwise work is estimated.
- No existing sensitive app code modified: all files stay in the isolated tool
  folder.
- Self-contained mini-product review: helper, tests, docs, and README links are
  colocated with the existing Meeting Assignment Tool.

## Suggested validation

Run:

`node --test tools/v2/team/meeting-assignment-tool/tests/meeting-assignment-guards.test.mjs`
