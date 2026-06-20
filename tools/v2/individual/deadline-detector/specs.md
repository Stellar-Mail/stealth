# Deadline Detector Specs

## Purpose

Define a self-contained V2 individual tool for detecting deadlines in message
content and presenting reviewable reminder candidates.

## Release Scope

- Release tier: V2 later-release tool
- Audience: individual
- Folder ownership: `tools/v2/individual/deadline-detector/`
- Integration status: isolated mini-product workspace

## In-Scope Behavior

- Model message-like inputs with sender, subject, body, received time, and user
  timezone.
- Extract obvious due dates from ISO dates, US dates, and simple relative
  phrases.
- Extract simple 24-hour due times when available.
- Classify outputs into detected, review, missed, and ignored states.
- Provide accessible UI states for loading, empty, error, and success flows.
- Keep all fixture data synthetic and folder-local.
- Give reviewers a single local test command.

## Out-of-Scope Behavior

- Main app routing or dashboard registration
- Inbox ingestion, mailbox mutations, or message persistence
- Calendar writes, reminder writes, notification delivery, or scheduling side
  effects
- Database schema changes
- Stellar wallet, contract, or payment behavior
- Shared design system changes

## Detection Contract

Each source message should include:

- `id`: stable fixture-local message identifier
- `type`: message category used for review context
- `sender`: synthetic sender address
- `subject`: message subject
- `body`: message body
- `receivedAt`: ISO timestamp
- `containsPersonalData`: false for local fixtures
- `userTimezone`: timezone label used in the UI

Each expected deadline should include:

- `id`: stable fixture-local deadline identifier
- `sourceMessageId`: source message identifier
- `title`: display title
- `dueDate`: ISO date or null
- `dueTime`: 24-hour time or null
- `timezone`: display timezone
- `status`: one of `detected`, `needs-review`, `missed`, `ignored`
- `urgency`: one of `overdue`, `today`, `soon`, `later`, `unknown`
- `confidence`: number from 0 through 1
- `reviewRequired`: true unless the result is high-confidence detected

## Status Rules

- `detected`: clear deadline language and a due date are present.
- `needs-review`: the message has a possible due date or relative timing but
  lacks enough deadline language to schedule automatically.
- `missed`: the due date is before the detector run date.
- `ignored`: the message is a digest, newsletter, or no-action message.

## Accessibility Contract

- Loading, empty, error, and success states must be screen-reader discoverable.
- Filter controls must be keyboard accessible through native radio inputs.
- Icon-only meaning must be paired with text, `aria-label`, or `aria-hidden`.
- Color must never be the only status signal.
- Reminder and review actions must expose descriptive accessible names.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Contributor Boundary

Keep all changes for this issue in this folder. Future integration issues should
define consent, reminder-write permissions, privacy handling, and audit behavior
before this tool touches a real mailbox or calendar.
