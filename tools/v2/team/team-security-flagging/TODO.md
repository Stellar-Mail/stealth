# Team Security Flagging (V2 later-release tool)

## Step 1 — Scaffold isolated engine
- [ ] Add `package.json` (tool-local) and `tsconfig.json` (tool-local)
- [ ] Create folder structure: `src/types`, `src/services`, `src/fixtures`, `tests`

## Step 2 — Implement core data model + validation
- [ ] Add enums and `FlagRecord` / payload types
- [ ] Add validation helpers enforcing model invariants

## Step 3 — Implement isolated in-memory service contract
- [ ] Implement `listFlags`, `getFlagById`, `createFlag`, `updateFlag`, `addReviewNote`, `resolveFlag`
- [ ] Enforce lifecycle rules (critical triage + resolved requirements)

## Step 4 — Add deterministic fixtures
- [ ] Seed sample flags for tests/demos

## Step 5 — Add unit/contract tests
- [ ] Validation tests (missing description, invalid category)
- [ ] Lifecycle transition tests (resolved requires notes + resolvedAt)
- [ ] Filtering tests

## Step 6 — Run tests/typecheck
- [ ] Run test command(s)
- [ ] Fix any TS/test failures

