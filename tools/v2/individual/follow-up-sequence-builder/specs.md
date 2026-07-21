# Follow-up Sequence Builder

Multi-stage follow-up sequences.

## Scope

- Release tier: V2
- Audience: individual
- Folder ownership: `tools/v2/individual/follow-up-sequence-builder/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Purpose

Build multi-stage follow-up sequence plans from normalized email input. Given an email context, return a sequence of timed follow-up steps with urgency-informed intervals and templates, allowing a user to review and execute a structured follow-up cadence.

## Functional Contract

- Input: `SequenceBuildInput` (messageId, subject, body, senderAddress, receivedAt) with optional fields (senderName, timeZone, threadHint).
- Output: `FollowUpSequence` with id, title, confidence, urgency, steps array, and warnings.
- Each step includes order, delayDays, template, condition, and stage (always `pending`).
- Urgency levels: low, normal, high, critical — determined by keyword analysis.
- Confidence levels: high, medium, low — determined by signal strength.
- Step templates are derived from urgency level with intervals ranging from 1 to 30 days.
- Warnings are returned as data, not exceptions.
- The engine must not send email, create calendar events, change labels, mark messages read, archive, or delete messages.

## Signal Categories

- Explicit follow-up request terms (follow up, keep me posted, circle back, touch base, etc.).
- Urgency indicators (asap, urgent, time-sensitive, etc.).
- Deadline mentions (by YYYY-MM-DD, due YYYY-MM-DD, deadline, before).
- Low-priority context markers (FYI, no rush, whenever, just sharing).
- Sender and thread hints supplied by the caller.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## UI And Accessibility Expectations

- Sequence title, step count, intervals, and urgency must be visible as text.
- Each step's delay, template, and condition must be reviewable.
- Warnings must be screen-reader reachable.
- Users must be able to edit, reorder, or skip steps before activating a sequence.

## Security And Performance Expectations

- Do not mutate the mailbox in baseline tests.
- Do not send sequence data to external services in baseline tests.
- Do not create external calendar events or send replies automatically.
- Signal scanning must be bounded for long messages.
- Fixtures must use synthetic senders, message ids, and dates only.

## Testing Expectations

See:

- `docs/test-plan.md`
- `docs/fixtures.md`
