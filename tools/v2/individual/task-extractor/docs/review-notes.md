# Task Extractor Review Notes

## What This Contribution Adds

This issue adds testing, documentation, and fixtures for the Task Extractor tool.
It validates the core extraction behavior and extraction rules without requiring
app UI, live email processing, or mailbox mutation.

## How To Review This Contribution

### 1. Verify the Fixture Structure

Open `fixtures/sample-task-extractions.json` and confirm:
- `sourceEmails` array contains realistic email examples
- Each email has `id`, `from`, `subject`, `body`, and `timestamp`
- All email addresses use `@example.test` (synthetic, not real)
- `expectedExtractions` maps tasks to source emails via `sourceEmailId`
- Each extraction includes `priority`, `status`, `assignee`, and `context`

### 2. Run the Automated Test

From the repository root:

```bash
node --test tools/v2/individual/task-extractor/tests/task-extraction-fixtures.test.mjs
```

The test validates:
- JSON parsing and fixture structure
- All priority and status values are in the allowed set
- Tasks are traceable to source email content
- All priority levels (high, medium, low) are represented
- High-priority tasks have clear markers (bug, critical, etc.)

### 3. Review Documentation

Check:
- `docs/test-plan.md` - outlines manual and automated review steps
- `docs/review-notes.md` (this file) - explains scope and known limits
- `specs.md` - defines the tool's purpose and boundary

### 4. Isolation Verification

Confirm that changes are limited to:
- `tools/v2/individual/task-extractor/`

No changes should touch:
- Main app shell or routing
- Dashboard or navigation
- Authentication or wallet core
- Mail rendering engine or inbox architecture
- Database schema or Stellar integration
- Existing design system

## Known Limitations

### Out of Scope for This Issue

- No email parsing implementation (fixture-based validation only)
- No UI components or calendar integration
- No live task synchronization to mail app
- No email account connection or authentication
- No task persistence or database storage
- No recurring task patterns or rule engines

### Extraction Assumptions

The fixture represents expected extraction behavior, but the actual implementation
is not included in this issue. When implementation code is added, tests should validate:

1. **Task Detection**
   - Numbered lists (1., 2., 3.) are parsed as tasks
   - Action-oriented language triggers extraction
   - Tasks are separated by line breaks or bullets

2. **Priority Assignment**
   - Explicit markers (HIGH PRIORITY, CRITICAL) override defaults
   - Implicit context (bug fixes, urgent terms) raise priority
   - Questions and suggestions default to low priority

3. **Assignee Extraction**
   - Names mentioned before tasks are assigned to that task
   - Absence of assignee is represented as `null`
   - Team-wide tasks have no specific assignee

4. **Due Date Inference**
   - Relative dates ("by Friday", "next week") are parsed
   - Absolute dates are captured as `dueDate`
   - Vague timeframes are represented as `null`

## Testing Notes for Contributors

- The fixture intentionally includes various task types to ensure coverage
- Email bodies use realistic language patterns (meetings, client requests, questions)
- The test suite is self-contained and requires no external dependencies beyond Node.js
- No fixtures contain real email addresses or personal data

## Integration Expectations

Future integration issues should handle:
- UI for reviewing extracted tasks before adding to task list
- Email threading and context preservation
- Conflict detection (duplicate tasks from multiple emails)
- Snooze and defer workflows
- Task list export and synchronization
- Permission models for shared inboxes or team mail

## Questions?

For implementation clarity, refer to:
- `specs.md` for tool purpose and scope
- `docs/test-plan.md` for testing checklist
- `fixtures/sample-task-extractions.json` for expected data structures
