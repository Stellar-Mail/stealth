# Team Task Board from Emails

Team Task Board from Emails is an isolated V2 team tool workspace. It converts
action-oriented email threads into a reviewable task board plan without wiring
anything into the production app yet.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/team-task-board-from-emails/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

This issue only adds folder-local documentation and test assets. No app install
is required to review the contribution.

Run the local fixture test from the repository root:

```bash
node --test tools/v2/team/team-task-board-from-emails/tests/task-board-fixtures.test.mjs
```

The test uses Node's built-in test runner and validates the sample email fixture
against the expected task board contract.

## Tool Workflow

1. Collect task-oriented emails from a shared team mailbox.
2. Extract candidate task title, owner, due date, priority, and source thread.
3. Group related emails into board columns: `new`, `triage`, `blocked`, `done`.
4. Preserve a source trail so reviewers can trace each task back to the email.
5. Show unresolved extraction gaps as review notes instead of silently guessing.

## Fixtures

The folder-local fixture at `fixtures/sample-task-emails.json` contains:

- an onboarding task that should enter `new`
- an invoice task that should enter `triage`
- a vendor contract task that should enter `blocked`
- a completed follow-up task that should enter `done`

Each fixture item includes a source email, expected board card, and explicit
review notes. The fixture is intentionally small so OSS contributors can reason
about the expected behavior without running the main app.

## Documentation Map

- `specs.md` defines the local product contract and boundaries.
- `docs/test-plan.md` lists manual and automated review steps.
- `docs/review-notes.md` explains what was validated and what remains out of
  scope until a future implementation issue.
- `tests/task-board-fixtures.test.mjs` validates the fixture contract.

## Known Limitations

- This contribution does not add UI components or app integration.
- Extraction logic is described through the fixture contract, not connected to
  live inbox data.
- Authorization, routing, database writes, and notification side effects remain
  out of scope for this isolated V2 folder.
