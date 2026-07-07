# Email Tone Rewriter Specs

## Purpose

Email Tone Rewriter is a V1 individual productivity tool that rewrites a draft
email into a requested tone while preserving the user's meaning, factual
anchors, and review control. The tool stays isolated in:

```text
tools/v1/individual/email-tone-rewriter/
```

This folder is a self-contained mini-product. It must not be wired into the
main application shell, dashboard layout, navigation, routing, inbox
architecture, compose/send flow, authentication, wallet core, Stellar core,
database schema, notification system, provider SDKs, AI providers, or shared
design system unless a future integration issue explicitly allows it.

## Release Scope

- Release tier: V1
- Audience: individual
- Owner folder: `tools/v1/individual/email-tone-rewriter/`
- Current implementation style: deterministic, local, rule-based rewrite
- Current persistence model: none
- Current network model: none

## Core Behavior Contract

The tool accepts a normalized draft request with:

- `subject`
- `bodyText`
- `tone`
- optional `maxWords`

The supported tones are:

- `concise`
- `friendly`
- `formal`
- `apologetic`

The rewriter must:

- preserve factual claims, names, dates, links, emails, amounts, quarters, and
  requested actions from the source draft;
- return a reviewable rewritten body and preserved key points;
- produce deterministic output for the same input;
- reject empty drafts, malformed input, unsupported tones, oversized drafts, and
  invalid length constraints with typed error results;
- keep send, save, and mutate action flags disabled;
- never send, save, persist, enqueue, notify, or mutate mailbox state.

## Module Boundaries

### Public API: `index.ts`

`index.ts` is the folder-local public export surface. Future callers should
import from this file or from explicitly documented folder-local modules only.

Rules:

- Export only modules that live under this folder.
- Do not export app shell, route, inbox, compose, wallet, Stellar, database,
  notification, provider, AI provider, or design-system dependencies.
- Keep cross-folder integration in a future wrapper issue.

### Service Layer: `services/`

The service layer owns pure rewrite logic, fixtures, and hardening guards.

Rules:

- `services/emailToneRewriter.ts` owns tone transformation, key-point
  extraction, deterministic validation, and UI-ready result states.
- `services/guards.ts` owns input sanitation and hard size limits before the
  engine runs.
- `services/fixtures.ts` owns synthetic examples for tests and local review.
- Services must not import React, routes, app stores, inbox state, compose
  state, wallet, Stellar, database, notification, provider SDKs, AI providers,
  or sibling tools.
- Services must not perform network calls, persistence writes, mailbox reads,
  sends, background jobs, or timers.

### Component Layer: `components/`

The component layer owns the folder-local review UI surface for idle, loading,
error, and success states.

Rules:

- Components may import React types and folder-local services.
- Components must render reviewable output without sending or saving drafts.
- Components must keep send/save/mutate actions visibly disabled until a future
  integration issue defines an explicit adapter.
- Components must not import shared design-system components, app shell routes,
  inbox modules, compose modules, auth state, wallet state, Stellar modules,
  database clients, notification systems, provider SDKs, AI clients, or sibling
  tools.

### Test Layer: `tests/`

The test layer owns local behavior, guard, component, and architecture checks.

Rules:

- Behavior tests should use local fixtures and deterministic expectations.
- Contract tests should use Node built-ins where possible so reviewers can run
  architecture checks without project dependency installation.
- Tests must not call live services, send mail, mutate mailbox state, persist to
  production stores, or require secrets.

### Documentation Layer: `docs/`

The docs layer owns architecture, data ownership, threat model, performance,
fixture, visual-style, and test-plan notes for this folder only.

Rules:

- Docs may describe future integration constraints.
- Docs must not imply current app integration where none exists.
- Future app wiring belongs in a new issue and should point back to these
  folder-local boundaries.

## Data Ownership

The tool owns only transient caller-supplied draft data and deterministic
rewrite results inside this folder. It does not own:

- live inbox messages;
- compose drafts outside this folder;
- sent mail;
- user accounts;
- authentication sessions;
- wallet accounts;
- Stellar transactions;
- database rows;
- notification state;
- provider credentials;
- AI prompts or external model responses.

See `docs/DATA_OWNERSHIP.md` for the detailed data and fixture contract.

## Dependency Rules

Allowed:

- relative imports that resolve inside
  `tools/v1/individual/email-tone-rewriter/`;
- React type imports in components;
- Vitest imports in existing Vitest tests;
- Node built-ins in architecture contract tests;
- TypeScript type-only imports inside this folder.

Not allowed:

- imports from `src/`, app aliases such as `@/`, parent folders, or sibling
  tools;
- main app routing, dashboard, inbox, compose, auth, wallet, Stellar, database,
  notification, provider, AI provider, or design-system modules;
- new npm dependencies for this architecture issue;
- live network calls, secrets, production credentials, provider SDKs, webhooks,
  background jobs, or server persistence.

## Future Contributor Contract

Future contributors may change:

- folder-local docs, tests, and fixtures;
- deterministic rewrite rules with matching tests;
- validation and guard limits with documented rationale;
- component accessibility and review-state rendering;
- adapter interfaces documented in this folder for a later integration issue.

Future contributors may not change:

- files outside `tools/v1/individual/email-tone-rewriter/` for this issue;
- main app shell, routes, navigation, dashboard, inbox, compose, auth, wallet,
  Stellar, database, notification, provider, AI provider, or design-system code;
- send/save/mutate behavior without explicit user confirmation and a separate
  integration issue;
- fixtures to include real user emails, production mailbox content, secrets,
  API keys, wallet data, or provider credentials;
- deterministic local behavior into live network behavior inside this issue.

## Out of Scope

- Sending emails.
- Saving drafts or rewrite history.
- Mutating mailbox, inbox, compose, routing, auth, wallet, Stellar, database, or
  notification state.
- Calling external AI providers or provider SDKs.
- Adding app shell, dashboard, route, navigation, or shared design-system
  integration.
- Running background jobs, queues, webhooks, or scheduled sync.

## Acceptance Criteria Mapping

| Issue requirement                                                                | Evidence                                                                        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Clear folder-local architecture plan                                             | `docs/ARCHITECTURE.md` and this file                                            |
| No main app, routing, inbox, wallet, Stellar, database, or design-system changes | Dependency rules and `tests/architecture-contract.test.mjs`                     |
| Specs explain what contributors may and may not change                           | Future Contributor Contract                                                     |
| Files changed are limited to this folder                                         | Git diff and contract test                                                      |
| Self-contained mini-product review                                               | README, specs, docs, services, components, fixtures, and tests are folder-local |
