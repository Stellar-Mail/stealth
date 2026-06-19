## Summary

Closes #685

Builds the **Team Digest Generator** tool's core feature inside its isolated folder `tools/v2/team/team-digest-generator/`.

## Deliverables

### Core Logic (`services/digest-generator.service.mjs`)

- `generateDigest(activity, date, generatedAt)` — transforms raw team activity into a structured daily digest
- `classifyItem(email)` — classifies emails into digest item types: `new_message`, `pending_item`, `completed_item`, `team_summary`
- `inferPriority(email)` — assigns priority (`low`, `medium`, `high`) based on content signals
- `requiresAttention(email)` — flags items needing human intervention
- `buildSummary(items)` — produces aggregate statistics (total items, attention count, distinct team members)

### Fixtures (`fixtures/sample-team-activity.json`)

- 6 sample team emails spanning multiple team members, threads, and scenarios
- Expected digest items covering all 4 digest types
- Summary statistics matching the expected output
- Review notes documenting fixture assumptions

### Tests (`tests/digest-fixtures.test.mjs`)

- Validates fixture structure, required fields, enum values, and cross-references
- Validates that the service produces output matching the expected digest contract
- Zero-dependency Node.js test (`node:test`)

### Documentation

- `docs/test-plan.md` — automated and manual review steps, edge cases
- `docs/review-notes.md` — validation summary, reviewer focus areas, follow-up work

### Upstream Fix

- Cleaned up PowerShell artifact placeholders in `specs.md`

## Verification

```bash
node --test tools/v2/team/team-digest-generator/tests/digest-fixtures.test.mjs
```

Both tests pass:

- Sample fixture follows the local digest contract
- Digest generator service produces matching output from fixture input

## Boundary Compliance

- All changes stay inside `tools/v2/team/team-digest-generator/`
- No modification to main app shell, routing, inbox, wallet, Stellar core, database, or design system
- No live network calls, secrets, or production data
- Deterministic fixtures replace external dependencies
- Folder-local API surface for future UI work
