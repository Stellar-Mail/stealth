# Follow-up Reminder Test Plan

## Goals

- Verify reminder suggestions are explainable, editable, and deterministic.
- Guard against automatic mailbox, calendar, or email-sending side effects.
- Confirm ambiguous dates stay as drafts with warnings.
- Keep all work inside the V1 individual tool folder.

## Automated Cases

1. Explicit follow-up request
   - Given an email asking for a reply by Friday.
   - Expect a `draft` reminder with title, due time, confidence, and signals.

2. Relative date
   - Given received time, timezone, and "follow up tomorrow".
   - Expect deterministic `dueAt` resolution.

3. Ambiguous date
   - Given "follow up soon" without a concrete date.
   - Expect `draft` with an ambiguous-date warning.

4. Duplicate prevention
   - Given an existing reminder for the same message and due time.
   - Expect no duplicate scheduled reminder.

5. Snooze action
   - Given a scheduled reminder and explicit snooze action.
   - Expect `snoozed` state and updated due time.

6. Complete action
   - Given a scheduled reminder and explicit complete action.
   - Expect `completed` state without mailbox mutation.

7. FYI false positive
   - Given an FYI-only newsletter or receipt.
   - Expect no scheduled reminder and low-confidence or no draft.

8. Empty content
   - Given missing subject and body.
   - Expect no reminder or an `unknown`/warning state without errors.

## Manual Review Checklist

- Confirm controls have accessible names.
- Confirm date warnings are visible as text.
- Confirm reminder title and due time can be edited before scheduling.
- Confirm no email is sent and no external calendar item is created.
- Confirm fixtures do not include real senders, message ids, or dates.

## Regression Expectations

- Adding a date parser rule requires one positive fixture and one ambiguous or
  false-positive fixture.
- Adding a new reminder action requires state-transition coverage.
- Any future inbox or calendar integration must preserve explicit user action
  before external side effects.
