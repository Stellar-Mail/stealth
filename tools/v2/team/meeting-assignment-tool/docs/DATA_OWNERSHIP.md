# Meeting Assignment Tool - Data Ownership

This document defines which module owns each data shape, how data moves through the tool, and what this isolated V2 tool must not read or mutate.

## Owned Data

| Data                | Owner                         | Source                                           | Mutation Rule                                                                    |
| ------------------- | ----------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `TeamMember`        | `types.ts`                    | Caller data or `fixtures/team-members.json`      | Service copies member load into a local counter; source arrays remain unchanged. |
| `Meeting`           | `types.ts`                    | Caller data or `fixtures/sample-meetings.json`   | Service sorts a copied array; source arrays remain unchanged.                    |
| `MeetingAssignment` | `types.ts` and service output | Created by `assignMeetings()`                    | Output is returned to the caller and not persisted.                              |
| `AssignmentSummary` | `types.ts` and service output | Built from assignment pass and local load deltas | Output is returned to the caller and not persisted.                              |
| `MeetingPayload`    | `helpers/validation.ts`       | Future form or integration payloads              | Validation is local and throws on unsafe structure.                              |

## Runtime State

The tool owns only transient in-memory state:

- Local `memberLoad` counters inside `assignMeetings()`.
- Optional simulated loading or failure state inside `createMeetingAssignmentService()`.
- Local test fixtures loaded from this folder.

The tool does not own:

- Live inbox messages.
- Calendar provider records.
- Team directory profiles.
- Authentication sessions.
- Wallet accounts.
- Stellar transactions.
- Database rows.
- Notification delivery state.

## Lifecycle

```text
Input arrays
    -> shallow copied by assignment service
    -> sorted planning pass
    -> local load counter adjusted
    -> AssignmentResult returned
    -> caller decides what to display or discard
```

No step writes to disk, localStorage, cookies, remote APIs, queues, databases, inbox state, calendar services, wallet state, or Stellar ledgers.

## Fixture Rules

- Fixtures are deterministic examples for tests and local development.
- Fixtures must not contain production names, emails, tokens, secrets, or private meeting content.
- Tests may read fixtures but must not write back to them.
- New fixtures should be small enough for quick review and local test execution.

## Validation Ownership

`helpers/validation.ts` owns structural validation for basic meeting payloads:

- Required `meetingId` and `title` fields.
- Assignee email shape checks.
- Meeting title sanitization.
- Description type and length checks.

Validation helpers do not authorize users, check team membership, contact mail providers, or resolve identities. Those concerns require a future integration issue and a separate adapter boundary.

## Performance Ownership

`helpers/performance.ts` owns local guardrails:

- Maximum assignee count per payload.
- Chunking helper for future batch-style UI work.

Performance helpers do not create background jobs, worker queues, polling loops, or event subscriptions.

## Future Integration Adapter Boundary

If a later issue connects this tool to real app data, it must add a new adapter layer that sits outside the current pure assignment engine. That adapter must be reviewed separately for:

- Authentication and authorization.
- Data minimization.
- Persistence and audit requirements.
- Provider rate limits.
- Error handling.
- Privacy and retention rules.

The current architecture issue documents those boundaries but does not implement the adapter.

## Privacy and Security Constraints

- Do not log raw meeting descriptions beyond local test fixtures.
- Do not include secrets, tokens, API keys, wallet data, or production identifiers in fixtures.
- Do not persist assignment outputs.
- Do not connect to external providers from this folder-local service.
- Keep future error messages structural and non-sensitive.
