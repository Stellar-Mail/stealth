# Email Tone Rewriter - Architecture Contract

This document defines the module boundaries, dependency rules, data flow, and
future integration constraints for the Email Tone Rewriter. The tool is a
self-contained V1 individual mini-product and must remain isolated in
`tools/v1/individual/email-tone-rewriter/`.

## Ownership Boundary

All source, fixtures, tests, and docs for this issue stay inside:

```text
tools/v1/individual/email-tone-rewriter/
```

This tool does not modify or depend on the main application shell, dashboard
layout, routing, inbox architecture, mail rendering engine, compose-send flow,
authentication, wallet core, Stellar core, database schema, notification
delivery, provider SDKs, AI providers, or shared design system.

## Folder Structure

```text
tools/v1/individual/email-tone-rewriter/
|-- README.md
|-- REVIEW_NOTES.md
|-- index.ts
|-- services.ts
|-- services.test.ts
|-- specs.md
|-- styles.css
|-- components/
|   |-- EmailToneRewriter.tsx
|   |-- EmailToneRewriterEmpty.tsx
|   |-- EmailToneRewriterError.tsx
|   |-- EmailToneRewriterLoading.tsx
|   |-- EmailToneRewriterSuccess.tsx
|   `-- index.ts
|-- docs/
|   |-- ARCHITECTURE.md
|   |-- DATA_OWNERSHIP.md
|   |-- fixtures.md
|   |-- performance.md
|   |-- test-plan.md
|   |-- threat-model.md
|   `-- visual-style.md
|-- services/
|   |-- emailToneRewriter.ts
|   |-- fixtures.ts
|   `-- guards.ts
`-- tests/
    |-- architecture-contract.test.mjs
    |-- components.test.ts
    |-- emailToneRewriter.test.ts
    `-- guards.test.ts
```

## Module Boundaries

### Public API: `index.ts`

The public API exports only folder-local service and component modules.

Rules:

- Export the pure engine, guards, fixtures, and components from this folder.
- Keep future app calls behind an explicit adapter or wrapper issue.
- Do not export app shell, routing, inbox, compose, auth, wallet, Stellar,
  database, notification, provider, AI provider, or design-system modules.

### Core Engine: `services/emailToneRewriter.ts`

The core engine owns deterministic rewrite behavior:

- Supported tone ids.
- Request and result types.
- Sentence splitting, tidying, capitalization, and key-point extraction.
- Tone transforms.
- Empty-body, unsupported-tone, and unsupported-input errors.
- Disabled send/save/mutate action flags.
- UI-ready state mapping.

Engine rules:

- No React imports.
- No network calls.
- No persistence writes.
- No mailbox, inbox, compose, auth, wallet, Stellar, database, notification, or
  provider access.
- No external AI provider calls.
- No mutation of caller-supplied objects.

### Guard Layer: `services/guards.ts`

The guard layer owns local hardening before the engine runs:

- Text sanitation for control, invisible, and decomposed characters.
- Subject, body, word-count, and maxWords bounds.
- Guard-specific typed errors for oversized and invalid length requests.
- Delegation to the core engine after input is sanitized and bounded.

Guard rules:

- Guards are pure and deterministic.
- Guards do not perform network work, storage writes, mailbox reads, or app
  integration.
- Guards may reject work before the engine runs but may not change ownership of
  the draft data.

### Fixture Layer: `services/fixtures.ts`

Fixtures provide synthetic review examples for tests and local development.

Rules:

- Fixtures must be fake and small.
- Fixtures must not contain real emails, production mailbox content, secrets,
  API keys, access tokens, wallet data, provider credentials, or private user
  information.
- Tests may read fixtures but must not write back to fixture modules.

### Component Layer: `components/`

Components own folder-local rendering for the idle, loading, error, and success
states:

- `EmailToneRewriterEmpty` renders labelled draft and tone controls.
- `EmailToneRewriterLoading` announces in-progress review work.
- `EmailToneRewriterError` renders deterministic validation errors.
- `EmailToneRewriterSuccess` renders the rewritten body and preserved facts for
  user review.
- `EmailToneRewriter` routes UI states to the matching component.

Component rules:

- Components may import React types and folder-local services.
- Components must not send, save, persist, or mutate a draft.
- Components must not import shared design-system modules, app routes, inbox
  modules, compose modules, auth state, wallet state, Stellar modules, database
  clients, notification systems, provider SDKs, AI clients, or sibling tools.

### Test Layer: `tests/`

Tests verify:

- Core rewrite behavior, deterministic output, validation errors, preserved key
  points, and disabled actions.
- Guard sanitation, hard limits, and deterministic delegation.
- Component semantics for labelled controls, status, alert, and review states.
- Architecture contract, required docs, import isolation, and forbidden
  integration imports.

## Data Flow

```text
Caller-supplied draft request
    -> safeRewriteEmailTone()
    -> sanitizeRewriteRequest()
    -> checkRequestLimits()
    -> rewriteEmailTone()
    -> ToneRewrite result with disabled actions
    -> folder-local component renders review state
```

The current flow does not send mail, save drafts, mutate inbox threads, create
database records, notify users, call providers, call AI services, run background
jobs, or touch wallet/Stellar state.

## Dependency Rules

Allowed:

- Relative imports that resolve inside
  `tools/v1/individual/email-tone-rewriter/`.
- React type imports and JSX in `components/`.
- Vitest imports in existing Vitest tests.
- Node built-ins in contract tests.
- TypeScript type-only imports inside this folder.

Not allowed:

- `src/` imports or aliases such as `@/`.
- Imports from sibling tools or parent directories that escape this folder.
- Main app routing, dashboard, inbox, compose, auth, wallet, Stellar, database,
  notification, provider, AI provider, or design-system modules.
- New npm dependencies for this architecture issue.
- Live network calls, secrets, production credentials, provider SDKs, AI
  clients, webhooks, queues, scheduled jobs, or server persistence.

## Future Contributor Contract

Contributors may:

- Add local tests, fixtures, and docs.
- Refine deterministic rewrite rules with matching behavior tests.
- Adjust guard limits with a documented rationale.
- Improve folder-local component accessibility and review-state rendering.
- Add adapter notes inside docs for a future integration issue.

Contributors may not:

- Wire this tool into application routes, navigation, inbox views, compose
  surfaces, or dashboard layouts.
- Send mail, save drafts, mutate mailbox state, persist rewrite history, deliver
  notifications, call provider SDKs, call AI providers, or run background sync.
- Connect to authentication, wallet flows, Stellar transactions, payment
  features, or database schemas.
- Change shared design-system files or global app state.
- Modify files outside this folder for this issue.

## Review Checklist

- [ ] All changed files are under `tools/v1/individual/email-tone-rewriter/`.
- [ ] `specs.md`, `docs/ARCHITECTURE.md`, and `docs/DATA_OWNERSHIP.md` agree
      on the folder boundary.
- [ ] No relative imports resolve outside this folder.
- [ ] No main app routing, inbox, compose, auth, wallet, Stellar, database,
      provider, AI provider, notification, or design-system wiring is
      introduced.
- [ ] `node --test tools/v1/individual/email-tone-rewriter/tests/architecture-contract.test.mjs`
      passes.
- [ ] Existing Vitest suites still pass when project dependencies are installed.

## Acceptance Criteria Mapping

| Issue Requirement                                                                | Evidence                                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Clear folder-local architecture plan                                             | This document and `specs.md`                                             |
| No main app, routing, inbox, wallet, Stellar, database, or design-system changes | Dependency rules and contract test                                       |
| Specs explain future contributor boundaries                                      | `specs.md` and Future Contributor Contract                               |
| Files changed are limited to this folder                                         | Git diff and contract test                                               |
| Self-contained mini-product review                                               | README, docs, services, components, fixtures, and tests are folder-local |
