# Data Ownership

## Main Application or Provider Owned

- Mailbox, message, and thread records
- Authentication, team membership, and authorization decisions
- Knowledge-base articles, revisions, visibility rules, and full content
- Search indexes and database persistence
- Analytics and user-selection persistence

The tool receives authorized snapshots and never mutates their sources.

## Tool Owned

- Normalized context derived from the provided mail snapshot
- In-memory candidate eligibility and ranking calculations
- Suggestion results, match reasons, warnings, and local selection state
- Sanitized local fixtures used by tests

Tool-owned runtime data is ephemeral until a future integration defines explicit
consumer-owned persistence.

## Data Flow

```text
consumer adapter -> mail context + authorized article snapshots
                                      |
                                      v
                           filter and ranking service
                                      |
                                      v
                        suggestions + reasons/warnings
```

The tool must treat access metadata as a filter, never as proof of authorization.
It must not retain raw credentials, authentication tokens, full private articles,
or unnecessary message content in fixtures, logs, errors, or analytics.
