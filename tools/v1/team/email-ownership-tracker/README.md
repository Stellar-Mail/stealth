# Email Ownership Tracker

Email Ownership Tracker is an isolated V1 team tool workspace for reconstructing
the ownership history of email threads from a stream of ownership events.

## Ownership Boundary

All work for this tool must stay inside the folder
tools/v1/team/email-ownership-tracker/. Do not wire this tool into the main app,
routing, inbox architecture, wallet core, Stellar core, database schema, or the
shared design system unless a future integration issue explicitly allows it.

## What This Issue Adds

This issue implements the folder-local core feature engine only:

- types/ defines the ownership event, history, anomaly, and report contracts.
- services/ provides a deterministic trackOwnership engine plus a
  sortOwnershipEvents helper.
- fixtures/ holds synthetic sample ownership events with an expected report.
- tests/ adds a standalone Node test that validates the fixture contract.

No UI, routing, mailbox, reminder, calendar, or database behavior is included.

## Reviewer Setup

No app install is required to review the fixture contract. From the repository
root, run:

    node --test tools/v1/team/email-ownership-tracker/tests/ownership-fixtures.test.mjs

## Engine Contract

trackOwnership(events) accepts an array of OwnershipEvent values and returns an
OwnershipReport.

### Input: OwnershipEvent

- id is a stable event identifier.
- threadId is the thread the event applies to.
- action is one of assigned, reassigned, released, or claimed.
- actor is who performed the action.
- owner is the resulting owner, or null for a release.
- previousOwner is an optional expected prior owner used for validation.
- timestamp is an ISO timestamp.
- note is optional free text.

### Output: OwnershipReport

- records has one entry per thread with the current owner, state (owned or
  unassigned), handoff count, first and last event times, and ordered history.
- anomalies lists non-fatal data issues (see below).
- summary totals events, threads, owners, handoffs, and anomalies.

### States and Anomalies

Events are processed in the order received. Malformed input is reported as an
anomaly instead of throwing, so a caller can surface it for manual review:

- release-without-owner: a release arrived with no active owner.
- duplicate-owner-assignment: a thread was assigned to its current owner.
- reassign-without-existing-owner: a reassignment arrived with no owner.
- owner-mismatch: an event previousOwner did not match the tracked owner.
- out-of-order-timestamp: an event predates the previous event on its thread.

## Known Limitations

- The engine reconstructs history only; it never writes to a mailbox, reminder,
  calendar, or database.
- Ownership identity resolution and permissions are deferred to a future
  integration issue.
- All fixture data is synthetic and uses the reserved .test suffix.
