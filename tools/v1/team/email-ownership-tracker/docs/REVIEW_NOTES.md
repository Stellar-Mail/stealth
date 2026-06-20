# Email Ownership Tracker Review Notes

## What This Adds

| Deliverable | Location |
| --- | --- |
| Pure service logic | `services/ownership.service.ts` |
| Local fixtures | `fixtures/ownership.fixture.ts` |
| Unit tests | `tests/ownership.service.test.ts` |
| Test plan | `tests/TEST_PLAN.md` |
| Setup notes | `docs/SETUP.md` |
| Specs cleanup | `specs.md` |

No files outside `tools/v1/team/email-ownership-tracker/` should be modified by
this contribution.

## Security Notes

- Identifiers are normalized and restricted to safe characters.
- Free-text reason and note fields remove control characters and collapse
  whitespace.
- Text fields are bounded before storage.
- Malformed ownership events throw instead of entering history.

## Performance Notes

- History reads are bounded with `MAX_HISTORY_LIMIT`.
- Functions are pure and do not mutate caller-provided arrays.
- There are no network calls, timers, storage adapters, or app imports.

## Verification

```bash
npx vitest run --config tools/v1/team/email-ownership-tracker/vitest.config.ts
```

Optional boundary check:

```bash
git diff --name-only | grep -v '^tools/v1/team/email-ownership-tracker/'
```
