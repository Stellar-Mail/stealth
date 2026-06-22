# Follow-up Reminder Architecture Contract

This document defines the folder-local architecture for the Follow-up Reminder
tool. It is scoped only to `tools/v1/individual/follow-up-reminder/` and does
not wire the tool into the main mail application.

## Module map

| Module | Owns | May depend on | Must not depend on |
| --- | --- | --- | --- |
| `index.ts` | Public folder-local exports | `services/*`, `components/*` | Main app shell, routes, inbox, wallet, Stellar, database, design system |
| `services/followUpReminder.ts` | Pure deterministic reminder suggestion engine | Local constants and helpers | Network calls, calendar APIs, mailbox mutation |
| `services/fixtures.ts` | Synthetic email samples and expected scenarios | Local service types | Production email data |
| `components/` | Isolated review UI pieces | Local props and local exports | Shared design-system internals, router, app stores |
| `hooks/` | Reserved future local UI state adapters | `index.ts`, local fixtures | Main app stores, router hooks, persistence APIs |
| `tests/` | Unit and component coverage for this folder | Local modules and synthetic fixtures | Live services or production data |
| `docs/` | Architecture, engine behavior, fixtures, style, test plan | Local file references | App-level integration promises |

## Data ownership

This folder owns only the data needed to propose a reviewable reminder:

- normalized email subject and body
- sender address and optional sender name
- source message id
- received timestamp and optional timezone
- thread hints supplied by the caller
- reminder signals, warnings, confidence, and draft/no-action state
- synthetic fixtures and expected local test data

The following data remains outside this folder:

- inbox message records and read/archive/delete state
- authenticated user/session state
- calendar provider connections and scheduled event ids
- notification scheduler state
- wallet or Stellar account state
- database persistence
- analytics and telemetry
- production email content

## Dependency rules

- Future feature work should import from `index.ts` rather than deep-linking to
  service or component internals.
- Services must stay pure and deterministic. Expected validation, ambiguous
  dates, low-confidence signals, and duplicate checks should be returned as
  review model fields or warnings rather than thrown exceptions.
- Components must receive data through props and local callbacks. They must not
  reach into app stores, routes, mailbox state, or persistence APIs.
- Future hooks may coordinate local idle, loading, draft, warning, and error
  state, but may not connect to main app stores without a separate integration
  issue.
- Tests must use synthetic fixtures. They must not call live calendar,
  notification, inbox, wallet, Stellar, or analytics services.

## Allowed future changes

Future contributors may add:

- deterministic reminder signal detectors;
- local hooks for review workflow state;
- isolated components for editing due time, snoozing, completing, or dismissing
  a reminder draft;
- synthetic fixtures and tests for ambiguous dates, duplicates, and
  low-confidence contexts;
- docs that clarify review flows, engine behavior, accessibility, or handoff.

## Forbidden future changes without a separate integration issue

Future contributors must not:

- mount this tool in a route, dashboard, navigation item, or inbox panel;
- send email, create calendar events, schedule notifications, archive, delete,
  label, or mark messages read;
- import from the main app shell, routing, inbox, wallet, Stellar, database,
  authentication, analytics, or shared design-system internals;
- add live network calls, provider keys, secrets, production data, or external
  calendar-provider mutations;
- persist reminder state outside this folder.

## Review checklist

- All modified files are under `tools/v1/individual/follow-up-reminder/`.
- Public exports remain intentional and folder-local.
- New behavior is covered by local tests, or the change is documentation-only.
- No live network calls, secrets, provider keys, production data, or calendar
  mutations were added.
- User review remains required before any future schedule, notification, or
  mailbox action.
