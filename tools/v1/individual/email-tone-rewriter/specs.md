# Email Tone Rewriter

Rewrite email tone for different contexts.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/email-tone-rewriter/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

Recommended internal structure:

- components/
- services/
- hooks/
- tests/
- docs/

# Email Tone Rewriter Specs

## Purpose

Rewrite a draft email into a requested tone while preserving the user's meaning
and keeping the result reviewable before any send action.

## Contributor boundary

All work for this tool should stay in:

`tools/v1/individual/email-tone-rewriter/`

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

- accept a normalized draft input with `subject`, `bodyText`, target `tone`, and
  optional length constraints;
- support a bounded set of tones such as `concise`, `friendly`, `formal`, and
  `apologetic`;
- preserve factual claims, dates, names, and requested actions from the source
  draft;
- return a reviewable rewritten body and a list of preserved key points;
- reject empty drafts or unsupported tone values with deterministic validation
  errors;
- never send, save, or mutate the mailbox before explicit user confirmation.

## Out of Scope

- sending emails;
- mutating mailbox state;
- adding routes, dashboard widgets, or navigation links;
- calling external AI providers from this folder;
- persisting rewrite history outside this folder.
