# SLA Deadline Tracker Specs

## Purpose

SLA Deadline Tracker helps teams monitor shared inbox response deadlines, identify messages that
are approaching breach, and prepare future escalation workflows without connecting to production
mail or notification systems.

## Scope

- Release tier: V1
- Audience: team
- Folder ownership: `tools/v1/team/sla-deadline-tracker/`
- Work mode: isolated mini-product until a future integration issue links it into the app.

## In Scope

- Define local module boundaries for components, services, hooks, tests, docs, and fixtures.
- Document data ownership and the shape of deadline records future contributors may introduce.
- Describe dependency limits and integration constraints.
- Keep all architecture notes and validation inside this folder.

## Out of Scope

- Main app shell, navigation, routing, or dashboard changes.
- Existing inbox architecture, wallet core, Stellar core, mail rendering, or database schema changes.
- Live network calls, production mail data, credentials, or external notification delivery.
- Global design system edits or root dependency changes.

## Data Ownership

The tool owns derived SLA metadata only:

- message reference ID
- shared inbox identity
- received timestamp
- SLA policy name and target duration
- computed due timestamp
- deadline state: `ok`, `due-soon`, `breached`, or `resolved`
- optional assignee and escalation note

The tool must not become the source of truth for message bodies, wallet identities, sender
credentials, delivery proofs, or permanent audit logs.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
