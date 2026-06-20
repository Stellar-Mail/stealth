# Team Security Flagging Specs

## Purpose

Define the isolated architecture contract for Team Security Flagging as a
self-contained V2 mini-product. This tool provides a local engine for team
members to flag security concerns, triage incidents, and track review state
without modifying the main app or production integration points.

## Release Scope

- Release tier: V2 later-release tool
- Audience: team
- Folder ownership: `tools/v2/team/team-security-flagging/`
- Integration status: isolated mini-product workspace

## In-Scope Behavior

- Model a security flag record for an email thread or message.
- Create a new flag with severity, category, description, reporter metadata,
  and source reference.
- List and filter flags by status, severity, category, and assigned team.
- View flag details and update lifecycle state locally.
- Track review/triage metadata and resolution notes.
- Expose local APIs, service contracts, and deterministic fixtures for reviewers.

## Out-of-Scope Behavior

- Main app shell, dashboard registration, or global routing integration
- Inbox ingestion, mail rendering, or message storage changes
- Authentication, authorization, wallet core, or Stellar core changes
- Database schema, shared API contracts, or backend persistence changes
- Notification delivery, role permission enforcement, or external APIs
- Modifications to the shared design system, global styles, or existing UI tokens

## Security Flagging Contract

Each flag record should include the following contract fields:

- `id`: stable local identifier
- `sourceMessageId`: message identifier for the flagged item
- `sourceThreadId`: optional thread identifier
- `reporterId`: reporting user identifier
- `reporterName`: display name of the reporter
- `createdAt`: ISO timestamp of when the flag was created
- `severity`: one of `low`, `medium`, `high`, `critical`
- `category`: one of `phishing`, `malware`, `data-exposure`,
  `policy-violation`, `social-engineering`, `other`
- `description`: plain-text summary of the concern
- `status`: one of `open`, `investigating`, `escalated`, `resolved`
- `assignedTeam`: optional team or queue name responsible for review
- `triageRequired`: boolean indicating whether human triage is required
- `reviewNotes`: array of review entries with `authorId`, `authorName`,
  `createdAt`, `note`
- `resolvedAt`: ISO timestamp when the flag was resolved or `null`

### Review Rules

- `critical` severity flags require explicit triage and must not be resolved
  without review notes.
- `escalated` status indicates the issue is pending handoff to a security team.
- `resolved` flags must include `resolvedAt` and at least one closing note.
- `open` flags with `severity` of `high` or `critical` should set
  `triageRequired` to `true` by default.
- Flags without `description` or `category` should remain invalid.

## Architecture Contract

The tool should be structured as a local engine with clear module responsibilities:

- `types/`: field definitions, enums, and contract models
- `services/`: pure business logic, in-memory state, and local persistence simulation
- `hooks/`: tool-local data loading and interaction abstractions
- `components/`: isolated UI surface for listing, creating, and reviewing flags
- `fixtures/`: deterministic sample flag data for tests and demos
- `tests/`: unit and contract tests that verify service and model behavior
- `docs/`: architecture and review guidance

## Review Expectations

- Provide a documented architecture contract in `docs/ARCHITECTURE.md`
- Include deterministic fixture data and service contract coverage
- Confirm boundaries with explicit out-of-scope behavior
- Keep all tool files inside the folder ownership boundary
- Preserve the existing Stealth app architecture by not wiring integration points

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
