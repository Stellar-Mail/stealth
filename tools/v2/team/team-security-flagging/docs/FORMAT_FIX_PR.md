# fix(team-security-flagging): format files for client checks

## Summary

- Formats all `tools/v2/team/team-security-flagging/` files with the repo-pinned Prettier version.
- Adds a PR note for the team security flagging feature changes.
- Keeps the fix isolated to the team security flagging folder.

## What Changed

The CI client format check runs:

```bash
bun x prettier --check .
```

The team security flagging files were not matching Prettier output, so the feature folder was
rewritten with Prettier 3.7.3. The formatter changes are mechanical: table alignment, line wrapping,
JSON formatting, compact function formatting, and TypeScript type layout.

The new `docs/PR.md` file was also formatted and cleaned up so it renders consistently in Markdown.

## Validation

```bash
npm.cmd exec --package=prettier@3.7.3 -- prettier --check tools/v2/team/team-security-flagging
node --test tools/v2/team/team-security-flagging/tests/security-flagging.test.mjs
npm.cmd run test
```

Results:

- Team security flagging format check passes.
- Team security flagging tests pass: 50 tests, 0 failures.
- Client unit tests pass: 31 files, 376 tests.

## Scope

- No route, navigation, design system, wallet, Stellar, database, or persistence changes.
- No changes outside `tools/v2/team/team-security-flagging/` are included in this PR.
