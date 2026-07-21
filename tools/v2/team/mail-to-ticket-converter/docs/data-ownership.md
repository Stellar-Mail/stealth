# Data Ownership

## Main Application Owned

- Mailbox and message records
- Authentication and team membership
- Attachment content and access authorization
- Database persistence
- Ticket-provider credentials and submission status

The tool receives snapshots of required values and never mutates these sources.

## Tool Owned

- Normalized input values created from the provided snapshot
- Conversion rules supplied to a service invocation
- In-memory ticket drafts, validation warnings, and review state
- Sanitized local fixtures used by tests

Tool-owned runtime data is ephemeral until a future integration defines an
explicit persistence adapter.

## Data Flow

```text
external adapter -> typed mail snapshot -> conversion service -> ticket draft
                                                         |
                                                         `-> warnings/errors
```

No raw credentials, authentication tokens, or unnecessary message content may be
stored in fixtures, logs, errors, or analytics. Attachment bytes remain owned by
the source system; only authorized metadata references may cross the boundary.
