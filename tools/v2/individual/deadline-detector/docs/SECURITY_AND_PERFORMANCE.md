# Deadline Detector - Security and Performance Notes

This document records the local security assumptions, unsafe input handling,
and performance limits for the isolated Deadline Detector tool.

## Scope

All guidance applies only to:

```text
tools/v2/individual/deadline-detector/
```

The tool does not read a live inbox, write reminders, write calendars, send
notifications, mutate messages, call providers, call AI services, persist data,
or connect to the app shell. Future integration must add an explicit adapter
issue before using real mailbox or calendar data.

## Threat Assumptions

- Message subjects, bodies, sender values, timestamps, and timezones are
  untrusted input.
- Attachment content is out of scope for this folder; only bounded metadata may
  be passed to guard helpers.
- Large inbox windows and long histories can create avoidable CPU and memory
  work even when individual messages are valid.
- Calendar, reminder, and notification writes are unsafe side effects unless a
  later issue defines user confirmation, permissions, audit behavior, and
  rollback handling.
- Fixture data must remain synthetic and must not include production email
  content, secrets, API keys, access tokens, wallet data, or provider
  credentials.

## Guard Helpers

`guards/deadline-guards.mjs` owns folder-local validation and sanitization:

- `sanitizeDeadlineText()` removes HTML-like tags, control characters,
  zero-width characters, leading/trailing whitespace, and oversized text.
- `validateMessageId()` rejects empty ids, path traversal, whitespace, and
  unsupported characters.
- `validateSourceType()` allowlists local source types.
- `validateSender()` rejects malformed email-like sender values and CRLF/null
  injection.
- `validateIsoTimestamp()` rejects missing, malformed, or unparseable
  timestamps.
- `validateTimezone()` rejects empty, oversized, or control-character timezone
  values.
- `sanitizeDeadlineMessage()` returns a sanitized copy without mutating caller
  input.
- `guardDeadlineMessageBatch()` caps the number of messages processed in one
  pass and sanitizes each message.
- `guardAttachmentMetadata()` accepts metadata only and rejects embedded file
  contents.
- `guardHistoryWindow()` caps history scans.
- `guardDetectionRequest()` validates a future adapter-shaped request with
  messages and options.

These guards are pure and synchronous. They do not perform network calls,
storage writes, mailbox reads, calendar writes, reminder writes, or background
jobs.

## Unsafe Inputs

| Input                              | Risk                                   | Handling                            |
| ---------------------------------- | -------------------------------------- | ----------------------------------- |
| Path-like message ids              | Path traversal or confusing audit ids  | Rejected by `validateMessageId()`   |
| CRLF or null bytes in sender       | Header/log injection                   | Rejected by `validateSender()`      |
| Control characters in subject/body | Hidden content or rendering surprises  | Removed by `sanitizeDeadlineText()` |
| HTML-like text in subject/body     | Accidental markup or script display    | Stripped before detection/review    |
| Invalid timestamps                 | Broken urgency calculations            | Rejected before detection           |
| Oversized body text                | Excess CPU/memory work                 | Truncated to the local body limit   |
| Oversized message batches          | Slow full-inbox scans                  | Rejected with a pagination hint     |
| Attachment contents                | File parsing, malware, memory pressure | Rejected; metadata only             |
| Oversized histories                | Avoidable scan cost                    | Rejected with a smaller-window hint |

## Performance Limits

The current guard constants are intentionally conservative:

| Limit                    | Value                           |
| ------------------------ | ------------------------------- |
| Message batch size       | 100 messages                    |
| Subject length           | 998 characters                  |
| Body length              | 20,000 characters               |
| Attachment count         | 25 metadata rows                |
| Attachment size metadata | 10,000,000 bytes per attachment |
| History events           | 500 rows                        |

Future integrations should paginate large inboxes and histories before calling
the detector. The detector should run on a bounded, user-confirmed slice rather
than scanning full accounts, teams, or long-running sync histories.

## Review Commands

Run from the repository root:

```bash
node --test tools/v2/individual/deadline-detector/tests/deadline-guards.test.mjs
node --test tools/v2/individual/deadline-detector/tests/deadline-fixtures.test.mjs
```

The guard test uses `fixtures/hostile-deadline-inputs.json` to verify malformed
input rejection, text sanitization, attachment metadata boundaries, and
oversized collection guards.

## Future Adapter Checklist

- Normalize real mailbox data into folder-local `DeadlineMessage` objects.
- Run `guardDetectionRequest()` before calling `detectDeadlines()`.
- Paginate inbox, team, attachment, and history data before scanning.
- Keep reminder/calendar writes behind explicit user confirmation.
- Avoid logging raw message bodies or private sender details.
- Keep provider, AI, database, notification, wallet, and Stellar integrations
  outside this folder unless a future issue explicitly allows them.
