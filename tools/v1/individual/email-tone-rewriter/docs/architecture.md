# Email Tone Rewriter Architecture Contract

This document defines the folder-local architecture for the Email Tone
Rewriter. It is scoped only to
`tools/v1/individual/email-tone-rewriter/` and does not grant permission to
wire the tool into the main app.

## Module map

| Module | Owns | May depend on | Must not depend on |
| --- | --- | --- | --- |
| `index.ts` | Public folder-local exports | `services/*` | Main app routes, inbox, wallet, Stellar, database, design system |
| `services/emailToneRewriter.ts` | Pure deterministic rewrite engine and typed results | Local constants and helpers | Network calls, mailbox APIs, external AI providers |
| `services/guards.ts` | Sanitization, hard limits, guarded entry point | Local service types and engine | Runtime secrets, storage, user/session state |
| `services/fixtures.ts` | Synthetic rewrite samples | Local types | Production email data |
| `hooks/` | Future UI state adapters | `index.ts`, local fixtures | Main app stores or router hooks |
| `components/` | Future isolated review UI | Local hooks, local props, local class names | Shared design-system internals or global app shell |
| `tests/` | Unit and future component coverage | Local modules and synthetic fixtures | Live services or production data |
| `docs/` | Architecture, test plans, fixtures, security, performance | Local file references | App-level integration promises |

## Data ownership

This folder owns only normalized draft data used for tone rewriting:

- `subject`
- `bodyText`
- target `tone`
- optional `maxWords`
- deterministic fixture ids and examples
- derived rewrite output, preserved key points, word count, and guard errors

The following data remains outside this folder and must not be read, written,
or mutated here:

- inbox message records
- send queues and SMTP/provider state
- authenticated user/session state
- wallet or Stellar account state
- database records
- analytics and telemetry
- production email content

## Dependency rules

- Future UI work should import from `index.ts` rather than reaching into
  service internals.
- Services must stay pure and deterministic. They should accept plain objects
  and return typed results instead of throwing for expected validation errors.
- The guarded entry point, `safeRewriteEmailTone`, is the boundary future UI or
  API adapters should call before rendering a rewrite.
- Tests must use local fixtures or synthetic inline inputs. They must not call
  live providers, read mailbox state, or require secrets.
- Documentation should describe integration constraints as follow-up work, not
  implement those integrations in this folder.

## Allowed future changes

Future contributors may add:

- new local tones with deterministic fixtures and tests;
- local hooks that model idle, loading, ready, and error states;
- isolated components that display a reviewable rewrite before save/send;
- additional guard limits or sanitizers with unit coverage;
- docs that clarify fixtures, threat model, performance, or handoff flows.

## Forbidden future changes without a separate integration issue

Future contributors must not:

- mount the rewriter in a route, dashboard, navigation item, or inbox panel;
- send, save, archive, delete, or persist email content;
- import from the main app shell, routing, inbox, wallet, Stellar, database,
  authentication, or shared design-system layers;
- add external AI provider calls, API keys, secrets, or production data;
- write telemetry or analytics events from this isolated folder.

## Review checklist

- All modified files are under `tools/v1/individual/email-tone-rewriter/`.
- New behavior has local tests or explicit documentation explaining why it is
  documentation-only.
- The public surface remains folder-local.
- No live network calls, secrets, provider keys, or production data were added.
- User review is preserved before any future save or send action.
