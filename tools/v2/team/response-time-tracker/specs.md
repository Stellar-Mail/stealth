# Response Time Tracker

Track response speed.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: tools/v2/team/response-time-tracker/

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

Recommended internal structure:

- components/
- services/
- hooks/
- tests/
- docs/

## Core feature engine

The core service pairs inbound team messages with the next outbound reply in
the same conversation, then reports aggregate and per-conversation response-time
metrics.

## Inputs

- Folder-local `ResponseTimeEvent` arrays.
- Deterministic ISO timestamps.
- Optional local SLA threshold in minutes.

## Outputs

- Loading state helper for future UI work.
- Ready state with totals, per-conversation response pairs, pending inbound
  messages, and SLA breach counts.
- Error state wrapper for malformed inputs.

## Non-goals

- No live network calls.
- No production email data.
- No secrets.
- No main app routing or shared design-system changes.

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
