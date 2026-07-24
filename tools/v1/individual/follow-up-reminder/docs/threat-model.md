# Follow-up Reminder — Threat Model and Hardening Notes

This document records the security assumptions for the isolated Follow-up
Reminder tool and the guards that enforce them. It covers this folder only and
does not describe the wider mail application.

## Trust boundary

- The reminder engine is a pure, local, rule-based text scanner.
- It performs no network calls, reaches no mailbox or wallet state, uses no
  eval or dynamic code, and contacts no external service.
- It treats all input as untrusted email data supplied by the caller.
- It is read-only: it returns a reminder review model and never sends, saves,
  or mutates anything. The engine does not send email, create calendar events,
  change labels, mark messages read, archive, or delete messages.

## Assets to protect

- Caller-supplied email content (must not be leaked, executed, or silently
  altered beyond safe sanitization).
- Process stability and responsiveness (no unbounded scanning or memory
  allocation).

## Unsafe inputs and mitigations

| Unsafe input                              | Risk                                              | Mitigation                                                             |
| ----------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| Oversized subject or body                 | Excessive CPU or memory, denial of service        | checkInputLimits rejects input above hard caps before the engine runs  |
| Very high word count in body              | Heavy work in date and signal scanning passes     | Word cap rejects early; engine scanning is bounded by MAX_SCAN_LENGTH  |
| Control characters such as NUL or BEL     | Log injection, terminal escapes, corrupted output | sanitizeText strips ASCII control chars and keeps tab and newline      |
| Zero-width or BOM characters              | Hidden or smuggled content, spoofing              | sanitizeText strips zero-width and BOM characters                      |
| Decomposed or duplicate unicode forms     | Inconsistent signal matching and output           | sanitizeText normalizes to NFC                                         |
| Non-string or missing required fields     | Type confusion, runtime errors                    | validateInput rejects before the engine runs                           |
| Invalid receivedAt (non-ISO, epoch, etc.) | Broken date arithmetic, crashes                   | validateInput checks that the date string produces a valid Date        |
| Empty or missing messageId                | Duplicate detection bypass, data confusion        | validateInput rejects empty or missing messageId                       |
| Massive existingReminders array           | Excessive iteration, degraded dedup performance   | validateOptions clamps the array; checkOptionsLimits rejects oversized |
| Malformed existingReminder entries        | Type errors in dedup logic                        | validateOptions filters out entries with missing or invalid fields     |
| Ambiguous or contradictory date signals   | Incorrect due date assignment                     | Engine handles ambiguity by setting dueAt to null with a warning       |
| Sequential calls with large state         | Memory growth across invocations                  | Each call is stateless; callers must manage their own state            |

## Explicitly out of scope

- HTML or markup sanitization for rendering (the engine scans plain text; any
  future UI must escape on display).
- Authentication, authorization, and rate limiting (belongs to a future
  integration issue, not this folder).
- Persistence, transport security, or calendar integration (nothing is stored
  or transmitted here; future scheduling integration requires explicit user
  action).
- Protection against UI-side attacks (XSS, clickjacking, etc.) — these belong
  to the integration layer that renders the reminder model.

## Determinism

All guards and engine functions are deterministic: the same input always yields
the same result, with no randomness, clock, or locale dependence. This keeps
the behavior testable and predictable under review.
