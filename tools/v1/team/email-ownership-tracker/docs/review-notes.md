# Email Ownership Tracker Review Notes

## Scope Checklist

- All changed files stay under `tools/v1/team/email-ownership-tracker/`.
- The engine is not imported by the main app.
- Fixtures use synthetic `.test` senders.
- There are no network calls, secrets, or production mailbox records.

## Behavior Checklist

- Unassigned and released threads can be claimed.
- A thread owned by another teammate cannot be claimed.
- Only the current owner can release an assigned thread.
- Returned thread and event objects are defensive copies.

## Follow-Up Boundaries

- UI states belong in the separate UI and accessibility issue.
- Persistence belongs in a future integration issue.
- Role-based override policy should be decided before mounting in the live inbox.
