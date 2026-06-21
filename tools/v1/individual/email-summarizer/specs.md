# Email Summarizer

Generate concise summaries of long emails.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/email-summarizer/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

Recommended internal structure:

- components/
- services/
- hooks/
- tests/
- docs/

# Email Summarizer Specs

## Purpose

Generate a concise, reviewable summary of a single long email for an individual
user.

## Contributor boundary

All work for this tool should stay in:

`tools/v1/individual/email-summarizer/`

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

- accept a normalized email input with `subject`, `sender`, `receivedAt`, and
  plain text body;
- produce a summary no longer than the configured sentence or character limit;
- extract action items separately from the narrative summary;
- preserve source email metadata for review and traceability;
- avoid inventing facts not present in the email body;
- return a validation error for empty or unsupported input.

## Out of Scope

- mutating mailbox state;
- adding routes, dashboard widgets, or navigation links;
- calling external AI providers from this folder;
- persisting summary history outside this folder.
