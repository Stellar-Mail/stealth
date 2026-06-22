# Email Snooze

Temporarily hide emails until a chosen time.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/email-snooze/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

Recommended internal structure:

- components/
- services/
- hooks/
- tests/
- docs/

# Email Snooze Specs

## Purpose

Temporarily hide one email until a future wake time chosen by an individual
user.

## Contributor boundary

All work for this tool should stay in:

`tools/v1/individual/email-snooze/`

Do not add imports from the main inbox, routing, wallet, Stellar, database, or
design-system layers until a later integration issue explicitly allows it.

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Core Behavior Contract

The future implementation should:

- accept a normalized email input with `id`, `subject`, `sender`, and
  `receivedAt`;
- accept an explicit snooze target such as an ISO timestamp, "tomorrow morning",
  or "next Monday";
- reject target times that are in the past or cannot be parsed safely;
- return a snooze draft containing source email metadata, normalized wake time,
  timezone, and review copy;
- avoid archiving, deleting, labeling, or moving the email before user
  confirmation.

## Out of Scope

- mutating mailbox state;
- adding routes, dashboard widgets, or navigation links;
- connecting to external calendar/reminder services;
- persisting snooze records outside this folder.
