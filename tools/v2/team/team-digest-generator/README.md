# Team Digest Generator

Team Digest Generator is an isolated V2 team tool workspace. It produces
daily team digests from email activity data without wiring anything into the
production app yet.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/team-digest-generator/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

This issue adds folder-local logic, fixtures, documentation, and test assets.
No app install is required to review the contribution.

Run the local fixture test from the repository root:

```bash
node --test tools/v2/team/team-digest-generator/tests/digest-fixtures.test.mjs
```

The test uses Node's built-in test runner and validates the sample team activity
fixture against the expected digest contract.

## Tool Workflow

1. Collect team email activity from a shared team mailbox.
2. Classify each email into a digest section: `new_message`, `pending_item`,
   `completed_item`, or `team_summary`.
3. Assign priority and attention flags based on content signals.
4. Aggregate per-team-member contribution summaries.
5. Produce a date-scoped digest with summary statistics.

## Fixtures

The folder-local fixture at `fixtures/sample-team-activity.json` contains:

- A set of sample team emails spanning multiple team members and sections.
- Expected digest items that should be produced from those emails.
- Summary statistics covering total items, attention-required count, and
  distinct team members.

Each fixture item includes a source email, expected digest item, and explicit
review notes. The fixture is intentionally small so OSS contributors can reason
about the expected behavior without running the main app.

## Core Logic

The folder-local service at `services/digest-generator.service.mjs` provides:

- `generateDigest(activity, date)` — takes raw team activity data and a date,
  returns a structured DailyDigest with classified items and summary stats.
- `classifyItem(email)` — classifies a raw email into a digest item type.
- `buildSummary(items)` — produces aggregate statistics across digest items.

All functions are deterministic and operate on plain JavaScript objects.

## Documentation Map

- `specs.md` defines the local product contract and boundaries.
- `docs/test-plan.md` lists manual and automated review steps.
- `docs/review-notes.md` explains what was validated and what remains out of
  scope until a future implementation issue.
- `tests/digest-fixtures.test.mjs` validates the fixture contract.
- `services/digest-generator.service.mjs` provides the core digest logic.

## Known Limitations

- This contribution does not add UI components or app integration.
- Digest logic is demonstrated through the fixture and service, not connected to
  live inbox data.
- Authorization, routing, database writes, and notification side effects remain
  out of scope for this isolated V2 folder.
