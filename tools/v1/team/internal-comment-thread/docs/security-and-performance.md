# Security and Performance - Internal Comment Thread

## Firm Privacy Boundary

Internal comments are team-only. Comment body text must never appear in any
reply, forward, external notification, log payload, or delivery path that could
reach an external sender.

## Guard Coverage

`guards/comment-guards.mjs` provides:

- target validation for message/thread references
- author validation against a team roster
- comment body sanitization and length limits
- comment history and team roster size guards
- external payload leakage checks for comment body text
- a local external reply payload builder that includes only reply content

## Unsafe Inputs

| Input | Risk | Guard |
| --- | --- | --- |
| target id | path traversal or lookup abuse | safe id allowlist |
| target kind | attaching comments outside shared inbox scope | `message` or `thread` only |
| author | CRLF injection or outsider access | email-like check and roster membership |
| comment body | control chars, empty body, render cost | sanitization and max length |
| comment history | expensive scans | max history size |
| team roster | expensive authorization checks | max team size |
| external payload | accidental comment leakage | explicit serialized payload inspection |

## Performance Limits

| Data set | Limit |
| --- | ---: |
| target id | 128 chars |
| author | 254 chars |
| comment body | 4,000 chars |
| comment history | 500 comments |
| team roster | 100 members |
| external payload inspection | 50,000 bytes |

Future integrations should page long histories and run leakage checks only on
bounded reply/notification payloads.

## Review Command

Run from the repository root:

```bash
node tools/v1/team/internal-comment-thread/tests/comment-guards.test.mjs
```

The tests use synthetic `.test` addresses only and make no live network calls.
