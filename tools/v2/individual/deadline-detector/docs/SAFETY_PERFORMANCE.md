# Safety and Performance Notes

## Scope

These notes apply only to `tools/v2/individual/deadline-detector/`. The tool
stays isolated from app routing, mailbox ingestion, reminder writes, calendar
writes, wallet code, Stellar integration, database state, and the shared design
system.

## Input guard behavior

`services/input-guards.ts` normalizes source messages before deadline detection
starts. It:

- accepts only array input and falls back to an empty list for non-arrays;
- caps message batches before running date or time matching;
- removes control characters and normalizes line endings;
- trims noisy whitespace while preserving paragraph boundaries;
- caps message ids, senders, subjects, bodies, and time zone labels;
- supplies stable fallback ids for malformed message objects;
- defaults unknown source types to `email`;
- keeps the original `containsPersonalData` flag only when explicitly true.

## Current limits

- Messages per run: 50.
- Message id: 80 characters.
- Sender: 160 characters.
- Subject: 240 characters.
- Body: 12,000 characters.
- Time zone label: 80 characters.

The service options can lower or raise the message, subject, and body limits for
future folder-local tests without changing the main app.

## Unsafe input categories

- Non-array source payloads.
- Missing or non-string ids, subjects, bodies, senders, or time zones.
- Very large message batches.
- Very large message bodies.
- Control characters or inconsistent line endings.
- Unknown source type values.

## Review checklist

- Confirm all changes stay in the Deadline Detector folder.
- Confirm normalization runs before date matching.
- Confirm malformed message objects do not crash title or evidence creation.
- Confirm large batches are capped before mapping.
- Confirm no live mailbox, reminder, calendar, database, or network writes are
  introduced.
