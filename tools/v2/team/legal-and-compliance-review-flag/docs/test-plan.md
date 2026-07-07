# Test Plan

Run from the repository root:

```sh
node tools/v2/team/legal-and-compliance-review-flag/tests/review-flag.test.mjs
node -e "import('./tools/v2/team/legal-and-compliance-review-flag/index.mjs').then(m => console.log(Object.keys(m).sort().join(',')))"
git diff --check
```

Expected coverage:

- Loading state returns `state: loading` and no items.
- Empty state returns `state: empty` and zero counts.
- Invalid item input returns `state: error` with local validation messages.
- Fixture report flags legal, compliance, export, and approval concerns.
- Routine fixture item remains clear with low severity.
- Flag summary order is deterministic.

No dependency install or network access is required for this tool.
