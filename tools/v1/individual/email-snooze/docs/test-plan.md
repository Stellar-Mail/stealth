# Email Snooze Test Plan

This folder does not contain executable tool code yet, so this document is the
folder-local test plan for issue #343. Convert each scenario below into unit or
component tests when the feature implementation lands.

## Unit Scenarios

1. Normalizes an explicit ISO wake time into a snooze draft.
2. Converts relative requests such as "tomorrow morning" with a fixed test clock
   and timezone.
3. Rejects wake times that are earlier than the current clock.
4. Rejects ambiguous free-text requests with a validation error.
5. Preserves source email id, subject, sender, and received timestamp in the
   snooze draft.
6. Produces deterministic output for repeated parsing of the same request and
   fixed clock.
7. Keeps mailbox mutation flags disabled until confirmation.
8. Handles missing email subject by falling back to sender and received time in
   review copy.

## Component Scenarios

1. Shows the proposed wake time, timezone, and source email before confirmation.
2. Lets the user edit the wake time without changing source email metadata.
3. Disables confirmation when validation fails.
4. Announces validation errors through accessible text associated with the wake
   time field.
5. Shows a non-destructive cancel path that leaves the source email untouched.

## Non-Goals for This Folder

- End-to-end inbox routing.
- Database persistence.
- Real mailbox archive or label actions.
- Calendar or push-notification integration.
