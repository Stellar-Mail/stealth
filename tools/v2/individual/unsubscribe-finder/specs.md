# Unsubscribe Finder Specs

## Purpose

Define a self-contained review contract for detecting unsubscribe opportunities
before any future inbox, link-following, or mailbox mutation integration.

## Release Scope

- Release tier: V2 later-release tool
- Audience: individual
- Folder ownership: `tools/v2/individual/unsubscribe-finder/`
- Integration status: isolated mini-product workspace

## In-Scope Behavior

- Model email records with synthetic unsubscribe signals.
- Distinguish safe unsubscribe candidates from suspicious links.
- Represent ignored transactional emails without side effects.
- Provide fixture coverage for each local candidate status.
- Give reviewers a single local test command.

## Out-of-Scope Behavior

- Main app routing or dashboard registration
- Inbox ingestion, mail rendering, or mailbox mutation changes
- Automatic link following or one-click unsubscribe execution
- Sender reputation services or external API calls
- Database schema or shared design system changes

## Unsubscribe Candidate Contract

Each expected candidate should include:

- `id`: stable fixture-local candidate identifier
- `sender`: sender display name or domain
- `method`: one of `header`, `body-link`, `none`
- `status`: one of `detected`, `needs-review`, `unsafe`, `ignored`
- `confidence`: number from 0 to 1
- `safeToOffer`: boolean that controls whether the UI can offer this action
- `sourceMessageId`: source email identifier
- `reason`: short review note for the status choice

## Review Rules

- standards-based header candidates may be detected when confidence is high
- body-link candidates require review unless a future security issue says
  otherwise
- unsafe links must never be offered as an action
- transactional messages without unsubscribe signals should be ignored
- every candidate must map back to a source message

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Contributor Boundary

Keep all changes for this issue in this folder. If a future issue adds live
unsubscribe actions, it should define link safety, consent, audit, and rollback
constraints before connecting this tool to production mailboxes.
