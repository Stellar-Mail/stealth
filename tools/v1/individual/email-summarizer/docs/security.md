# Email Summarizer — Security & Performance Hardening

This document records the threat assumptions, unsafe-input handling, and
performance guards for the Email Summarizer tool. All behavior described here is
implemented in `services/security.ts` and exercised by `tests/security.test.ts`.
Everything stays inside this tool folder: no network calls, no mailbox
mutation, no external providers, and no main-app imports.

## Trust boundary

The engine (`services/emailSummarizer.ts`) is pure and deterministic, but it
assumes a well-formed `NormalizedEmail`. In a real deployment the email body,
subject, and sender originate from untrusted senders. The hardening layer sits
in front of the engine and treats every field as hostile until validated.

## Threat assumptions and unsafe inputs

| Unsafe input                                    | Risk                                                     | Mitigation                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Non-object, missing, or wrong-typed fields      | Runtime errors and undefined downstream behavior         | `validateEmailInput` rejects with typed `not-an-object` / `missing-field` / `wrong-type` issues |
| Control characters or terminal escape sequences | Log/terminal injection, corrupted rendering              | `stripControlChars` replaces them with spaces while preserving tab and newline                  |
| HTML or script markup in subject or sender      | Markup or script injection if later rendered as HTML     | `stripHtml` removes tags before the value is stored                                             |
| Oversized body (multi-MB paste)                 | Excess CPU and memory in sentence splitting and scanning | Soft cap truncates at `bodyTruncateLength`; hard cap rejects past `maxBodyLength`               |
| Oversized subject or sender                     | Unbounded storage and display                            | Capped to `maxSubjectLength` / `maxSenderLength`                                                |
| Invalid `receivedAt` timestamp                  | Misleading traceability metadata                         | Preserved as-is but flagged with an `invalid-timestamp` warning                                 |

## Size limits

Defined in `SECURITY_LIMITS`:

- `maxSubjectLength` — 1000 characters
- `maxSenderLength` — 320 characters (RFC 5321 address ceiling)
- `maxReceivedAtLength` — 64 characters
- `bodyTruncateLength` — 20000 characters (soft cap: truncate and warn)
- `maxBodyLength` — 100000 characters (hard cap: reject)

## Performance notes

- The engine runs `splitSentences`, `extractActionItems`, and a narrative filter
  over the whole body, so cost grows with body length. Bounding the body length
  before summarizing keeps the work predictable.
- Truncating at `bodyTruncateLength` (rather than rejecting) keeps the common
  "very long email" case usable while capping the worst case.
- Bodies past `maxBodyLength` are rejected outright so a single hostile payload
  cannot force a large allocation or a long-running scan.
- All limits are plain constants; there are no nested loops over attachments or
  recipients and no quadratic scans, so processing stays linear in body length.

## Failure model

`validateEmailInput` never throws. It returns either a sanitized success with
optional non-fatal warnings (truncation, invalid timestamp), or a typed failure
listing why the input was rejected. `summarizeEmailSafely` composes this guard
with the pure engine: hostile input becomes a typed `unsupported-input` result
instead of ever reaching `summarizeEmail`.
