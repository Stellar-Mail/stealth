# Collision Detection Validation Notes

## What This Issue Can Validate

- Folder ownership and review boundaries are clear.
- Fixture data is parseable JSON.
- The expected outcomes cover duplicate, possible duplicate, distinct, and
  invalid-input cases.
- The test plan is folder-local and does not depend on app-wide test wiring.

## What This Issue Cannot Validate Yet

- Production mailbox retrieval.
- Real semantic scoring accuracy.
- UI warnings or override flows.
- Authorization for team-level duplicate checks.
- Database persistence or audit logging.

## Manual Validation Steps

1. Confirm the changed files are limited to `tools/v1/team/collision-detection/`.
2. Parse `fixtures/collision-cases.json`.
3. Review `tests/test-plan.md` against the expected outcomes in `specs.md`.
4. Confirm no instructions require live mailbox data or external service calls.

## Follow-Up Recommendations

- Add a pure detector service that consumes the input shape from `specs.md`.
- Add Vitest coverage for all fixture outcomes.
- Add UI copy only after a future integration issue defines where the warning
  should appear.
