# Email Ownership Tracker Specs

## Purpose

Email Ownership Tracker helps teams avoid duplicate replies and dropped handoffs by maintaining a
derived record of message ownership in shared inbox workflows.

## Scope

- Release tier: V1
- Audience: team
- Folder ownership: `tools/v1/team/email-ownership-tracker/`
- Work mode: isolated mini-product until a future integration issue links it into the app.

## In Scope

- Define folder-local module boundaries for components, services, hooks, tests, docs, and fixtures.
- Document ownership event data, derived state, and current-owner summary responsibilities.
- Describe dependency limits and future integration constraints.
- Keep all architecture notes and validation inside this folder.

## Out of Scope

- Main app shell, navigation, routing, dashboard layout, or global providers.
- Existing inbox architecture, wallet core, Stellar core, mail rendering, or database schema changes.
- Live network calls, production mail data, credentials, private mailbox contents, or payment data.
- Global design system edits or root dependency changes.

## Data Ownership

The tool owns derived ownership metadata only:

- message reference ID
- shared inbox address
- subject preview label
- ownership action: `claimed`, `released`, `reassigned`, or `escalated`
- actor, current owner, and previous owner addresses
- action timestamp
- optional team-only handoff note

The tool must not become the source of truth for message bodies, wallet identities, sender
credentials, delivery proofs, payment details, or permanent audit logs.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
