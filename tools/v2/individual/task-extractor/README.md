# Task Extractor

Task Extractor is an isolated V2 individual tool workspace for extracting and
organizing tasks from emails before a future mail-app integration.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/task-extractor/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

This issue adds folder-local documentation, fixtures, and a standalone Node test.
No app install is required to review the contribution.

Run from the repository root:

```bash
node --test tools/v2/individual/task-extractor/tests/task-extraction-fixtures.test.mjs
```

The test validates the sample task extraction fixture against the local task
extraction contract described in `specs.md`.

## Task Extraction Workflow

1. Accept email content (subject, body, sender context).
2. Identify task patterns (numbered lists, action-oriented language).
3. Extract task text, priority, and assignee.
4. Infer due dates from context clues (e.g., "by Friday").
5. Assign priority based on explicit markers or content analysis.
6. Keep sending, archival, and task persistence out of scope until a future
   integration issue allows it.

## Fixtures

The folder-local fixture at `fixtures/sample-task-extractions.json` contains:

- Three source emails with realistic task patterns
- Multiple task extractions per email showing various patterns
- High-priority tasks with explicit markers (bug fixes, critical items)
- Medium-priority tasks from project updates and feature requests
- Low-priority tasks from questions and suggestions
- Tasks with and without assigned owners
- Tasks with and without inferred due dates

The fixture intentionally uses `example.test` addresses and synthetic company
names so contributors can validate behavior without using real email accounts.

## Documentation Map

- `specs.md` defines the local task extraction contract and scope.
- `docs/test-plan.md` lists automated and manual review steps.
- `docs/review-notes.md` explains validation, implementation expectations, and known limits.
- `tests/task-extraction-fixtures.test.mjs` validates the fixture contract.
- `fixtures/sample-task-extractions.json` provides sample task extractions.

## Folder Structure

```
task-extractor/
├── README.md                                     # This file
├── specs.md                                      # Tool specification
├── fixtures/
│   └── sample-task-extractions.json              # Sample fixture data
├── tests/
│   └── task-extraction-fixtures.test.mjs         # Node test suite
└── docs/
    ├── test-plan.md                              # Test strategy
    └── review-notes.md                           # Implementation notes
```

## Known Limitations

- This contribution does not add app UI or live email parsing.
- Task behavior is represented through fixture expectations only.
- Email account connection, task persistence, and mailbox mutation remain out
  of scope for this isolated V2 folder.
- Recurring task patterns and advanced rule engines are not included.
- Calendar integration is deferred to future integration work.

## Next Steps

When implementation code is added in future issues:

1. Implement email body parsing for task detection patterns
2. Build priority assignment logic based on markers and content analysis
3. Add assignee extraction from email mentions
4. Implement due date inference from context clues
5. Create fixtures for edge cases and parsing challenges
6. Add integration tests with the mail app task list

See `docs/review-notes.md` for a complete list of future integration expectations.
