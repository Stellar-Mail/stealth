# Deadline Detector - Data Ownership

This document defines owned data, runtime state, privacy expectations, and
future adapter boundaries for the folder-local Deadline Detector.

## Owned Data

| Data                             | Owner                                  | Source                                                  | Mutation Rule                                                                 |
| -------------------------------- | -------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `DeadlineMessage`                | `types/deadline.ts`                    | Caller data or `fixtures/sample-deadline-messages.json` | Service reads message fields and does not mutate the source array or objects. |
| `DetectedDeadline`               | `types/deadline.ts` and service output | Created by `detectDeadlines()`                          | Returned to caller and not persisted by this tool.                            |
| `DeadlineDetectionSummary`       | `types/deadline.ts` and service output | Reduced from detection results                          | Returned to caller and not persisted by this tool.                            |
| `DeadlineDetectorServiceOptions` | `types/deadline.ts`                    | Caller-provided options                                 | Used only to set deterministic `now` and fallback timezone.                   |
| UI filter/view state             | `components/DeadlineDetectorTool.tsx`  | Local React state                                       | Lives only in memory while the component is mounted.                          |

## Runtime State

The current tool owns only transient in-memory state:

- Local detection arrays created inside `detectDeadlines()`.
- Local urgency ranking inside `sortDetectedDeadlines()`.
- Local component view state for loading, error, ready, and status filtering.
- Local synthetic fixture data read by tests.

The tool does not own:

- Live inbox messages.
- Reminder records.
- Calendar events.
- Notification delivery state.
- User accounts or authentication sessions.
- Wallet accounts.
- Stellar transactions.
- Database rows.
- Audit logs.

## Lifecycle

```text
DeadlineMessage[] input
    -> text normalization in the service
    -> deadline status, urgency, confidence, and reviewRequired calculation
    -> sorted DeadlineDetectionResult
    -> component rendering or caller handling
    -> discarded unless a future integration adapter stores it
```

No step writes to disk, localStorage, cookies, remote APIs, queues, databases,
inbox state, calendar providers, reminder schedulers, notification services,
wallet state, or Stellar ledgers.

## Fixture Rules

- Fixture messages are synthetic and use `.test` senders.
- Fixture data must set `containsPersonalData` to `false`.
- Fixture bodies must not contain real email content, private names, account
  numbers, tokens, API keys, secrets, or production identifiers.
- Tests may read fixtures but must not write back to them.
- New fixture rows should be small enough for quick review and local test
  execution.

## Detection Ownership

`services/deadline-detector.service.ts` owns deterministic local parsing:

- ISO date detection.
- US date detection.
- Simple relative phrase detection for today, tomorrow, and next week.
- 24-hour time extraction.
- Deadline signal and ignore signal classification.
- Urgency, confidence, and review requirement calculations.

The detector does not authorize users, resolve sender identity, contact mailbox
providers, write reminders, update calendars, schedule jobs, or deliver
notifications.

## Component State Ownership

`DeadlineDetectorTool` owns presentation-only state:

- `viewState`: local loading, error, or ready state.
- `filter`: local result filter state.
- Derived `result` and `filteredDeadlines` memoized from caller-provided
  messages.

Callback props such as `onCreateReminder`, `onReviewDeadline`, and
`onRequestMessages` are external extension points. The component calls them but
does not implement persistence, mailbox mutation, or scheduling.

## Future Integration Adapter Boundary

If a later issue connects this tool to real app data, it must add an adapter
layer separate from the pure detection service. That adapter must be reviewed
for:

- User consent before scanning live mailbox content.
- Reminder-write permission prompts.
- Calendar provider permissions and failure handling.
- Duplicate deadline suppression.
- Privacy-preserving evidence snippets.
- Audit history and retention rules.
- Rate limits and provider error handling.

The current architecture issue documents those boundaries but does not implement
the adapter.

## Privacy and Security Constraints

- Do not log raw message bodies from live mailboxes.
- Keep fixture senders and message bodies synthetic.
- Do not persist detection output.
- Do not include secrets, tokens, API keys, wallet data, production IDs, or
  private meeting/email content in fixtures.
- Keep future error messages structural and non-sensitive.
