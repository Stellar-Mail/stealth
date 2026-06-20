# Email-to-Todo Converter

Convert emails into tasks.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/email-to-todo-converter/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

# Email-to-Todo Converter Specs

## Purpose

Convert one normalized email into a task draft that an individual user can
review before saving to a future task system.

## Contributor boundary

All work for this tool should stay in:

```text
tools/v1/individual/email-to-todo-converter/
```

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

- accept a normalized email input with `subject`, `sender`, `receivedAt`, plain
  text body, and optional labels;
- detect actionable content in the email (the specific extraction method —
  keyword matching, automatic parsing, or LLM-assisted - is an open
  implementation decision, not fixed by this spec);
- produce a task draft with title, notes, source email metadata, suggested due
  date, and suggested priority;
- keep extraction deterministic for the same input;
- preserve user review before any task is saved or synced.

## Open Questions

- Extraction strategy: keyword/pattern matching, automatic full-body parsing,
  or LLM-assisted extraction are all viable; this spec does not mandate one.
- Storage destination: where a reviewed task draft persists once approved is
  not yet decided.

## Out of Scope

- mutating or archiving mailbox messages;
- adding routes, dashboard widgets, or navigation links;
- connecting to external task systems;
- persisting task drafts outside this folder.
