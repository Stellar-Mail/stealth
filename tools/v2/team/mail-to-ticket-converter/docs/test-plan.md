# Test Plan

Run from the repository root:

```sh
node tools/v2/team/mail-to-ticket-converter/tests/ticket-converter.test.mjs
node -e "import('./tools/v2/team/mail-to-ticket-converter/index.mjs').then(m => console.log(Object.keys(m).sort().join(',')))"
git diff --check
```

Expected coverage:

- Loading state returns `state: loading` and no tickets.
- Empty state returns `state: empty` and zero counts.
- Invalid message input returns `state: error` with local validation messages.
- Fixture report converts five local messages into ticket candidates.
- Security outage mail routes to `Security Response` with critical priority.
- Reply prefixes are normalized and source metadata is preserved.
- Local configuration can override ticket IDs and queue names.

No dependency install or network access is required for this tool.
