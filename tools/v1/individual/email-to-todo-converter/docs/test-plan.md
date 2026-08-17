# Email-to-Todo Converter Test Plan

This folder does not contain executable tool code yet, so this document is the
folder-local test plan for issue #358. Convert each scenario below into unit or
component tests when the feature implementation lands.

## Unit Scenarios

1. Extracts a task title from a direct request in the email subject.
2. Extracts a task title from the first actionable sentence in the body when the
   subject is generic.
3. Preserves the source sender, source subject, and received timestamp in task
   metadata.
4. Converts explicit due dates such as "by Friday" or "due 2026-07-01" into a
   normalized due-date field.
5. Leaves the due-date field empty when the email has no deadline.
6. Assigns high priority for urgent language and normal priority otherwise.
7. Produces deterministic output for repeated parsing of the same email.
8. Rejects empty subject/body inputs with a validation error instead of creating
   a blank task.

## Component Scenarios

1. Shows the proposed task title, notes, due date, and priority before saving.
2. Lets the user edit the proposed task fields without changing the source email
   metadata.
3. Keeps destructive mailbox actions out of the review surface.
4. Announces validation errors through accessible text associated with the
   failing field.

## Non-Goals for This Folder

- End-to-end inbox routing.
- Database persistence.
- External task-provider sync.
- Wallet or Stellar integration.
