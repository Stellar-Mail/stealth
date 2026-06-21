# Review Notes

## Summary

This change prepares the isolated Collision Detection tool for review by adding
synthetic fixtures, a folder-local test plan, validation notes, and cleaned scope
documentation.

## What Changed

- Rewrote the README so contributors can review the folder independently.
- Cleaned `specs.md` to remove generated placeholder artifacts and describe the
  V1 team scope.
- Added deterministic synthetic fixture cases for duplicate, possible duplicate,
  distinct, and invalid draft outcomes.
- Added a manual test plan that can later be converted into an automated
  folder-local test.
- Added validation notes and explicit safety boundaries.

## Out of Scope

- No production detector service.
- No app integration.
- No live mailbox data.
- No wallet, Stellar, database, routing, auth, or shared design-system changes.

## Suggested Reviewer Checks

1. Confirm every changed file is under `tools/v1/team/collision-detection/`.
2. Confirm the fixture recipients use `.test` addresses.
3. Confirm the test plan maps every fixture to an expected result.
4. Confirm the README and specs describe an isolated review surface.
