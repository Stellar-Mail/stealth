# Task Extractor Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/individual/task-extractor/tests/task-extraction-fixtures.test.mjs
```

Expected results:

- the sample fixture parses as JSON
- each source email maps to one or more expected task extractions
- all extraction rule statuses and priorities are represented in the fixture
- extracted tasks are traceable to source email content
- priority levels (high, medium, low) are correctly assigned
- high-priority tasks are clearly marked in email content (bug fixes, critical items)
- assignees and due dates are correctly parsed when present

## Manual Review Checklist

1. Open `fixtures/sample-task-extractions.json`.
2. Confirm all email addresses use `@example.test` synthetic domain.
3. Confirm email bodies contain extractable task patterns:
   - Numbered lists (1., 2., 3.)
   - Action-oriented language ("needs to", "should", "please")
   - Priority indicators ("HIGH PRIORITY", "critical", "urgent")
4. Confirm each expected extraction has a traceable `sourceEmailId`.
5. Confirm `docs/review-notes.md` documents out-of-scope behavior.
6. Confirm no files outside `tools/v2/individual/task-extractor/` changed.
7. Run the test and verify all assertions pass.

## Edge Cases Covered

- Multiple tasks extracted from a single email
- Tasks with assigned owners
- Tasks with due dates (inferred from context)
- Priority inference from explicit markers (HIGH PRIORITY, bug fix)
- Priority inference from implicit context (meeting follow-up = medium, questions = low)
- Tasks without clear assignees
- Questions and suggestions treated as low-priority tasks

## Future Integration Tests

When implementation code is added, add tests for:

- Email body parsing and task tokenization
- Due date inference from context clues (e.g., "by Friday", "next week")
- Assignee extraction from explicit mentions vs. context
- Duplicate task detection
- Task status lifecycle (pending → completed → blocked)
- Task-to-calendar synchronization
- Recurring task pattern detection
- Integration with mail app task lists
