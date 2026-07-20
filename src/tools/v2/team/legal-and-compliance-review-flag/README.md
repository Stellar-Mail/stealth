# Legal and Compliance Review Flag — Review Notes

Isolated V2 "team" tool. All review material for this tool lives in this folder.

## Current state

The non-UI execution contract for this tool is **not yet merged to `main`**, so
there is no `engine.ts`/`types.ts` to exercise yet. To satisfy the issue
("documented test plan if code is not ready"), this folder ships:

- `TEST_PLAN.md` — the expected reducer contract + the list of tests to add.
- `fixtures.ts` — typed fixtures (`ReviewFlag`, `RaiseInput`, `ResolveInput`,
  sample flags/inputs/list).

## What to review

1. **Test plan** — `TEST_PLAN.md` defines the `raise` / `resolve` / `list`
   lifecycle and the edge cases (duplicate raise, resolve-missing, empty list,
   immutability).
2. **Fixtures** — `fixtures.ts` mirrors the shape the future `engine.ts` must
   satisfy, so tests can be dropped in without rework.
3. **Once code lands** — add `__tests__/reviewFlag.test.ts` following the plan
   and run:

```sh
npm install
npx vitest run src/tools/v2/team/legal-and-compliance-review-flag
```

## Known limitations

- No live logic yet; this is a review-ready scaffold, not a passing test suite.
- Severity/resolution vocabulary is provisional until the contract merges.
