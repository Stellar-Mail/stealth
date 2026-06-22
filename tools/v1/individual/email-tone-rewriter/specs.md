# Email Tone Rewriter

Rewrite email tone for different contexts.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/email-tone-rewriter/`

This is a self-contained tooling workspace. Do not wire this tool into the main
app, routing, inbox architecture, wallet core, Stellar core, database, mail
send actions, or design system unless a future integration issue explicitly
allows it.

## Internal structure

- `index.ts` is the only folder-local public API surface future tool work
  should import from.
- `services/` owns pure rewrite, fixture, and guard logic.
- `hooks/` is reserved for future UI state adapters and must stay free of main
  app imports until an integration issue exists.
- `components/` is reserved for future isolated UI and must use local props and
  local class names only.
- `tests/` owns unit and future component coverage for this folder.
- `docs/` owns fixtures, test plans, architecture, threat model, performance,
  and contributor handoff notes.

# Email Tone Rewriter Specs

## Purpose

Rewrite a draft email into a requested tone while preserving the user's meaning
and keeping the result reviewable before any send action.

## Contributor boundary

All work for this tool should stay in:

```text
tools/v1/individual/email-tone-rewriter/
```

Do not add imports from the main inbox, routing, wallet, Stellar, database,
mail rendering, authentication, or design-system layers until a later
integration issue explicitly allows it.

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Core Behavior Contract

The implementation should:

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

## Ownership and dependencies

- Draft text, selected tone, length constraints, synthetic fixtures, and guard
  limits are owned by this folder.
- Mailbox records, authenticated users, routing, persistence, wallet/Stellar
  state, analytics, and design-system state are owned outside this folder and
  must not be imported or mutated here.
- External AI providers are out of scope for this isolated V1 contract. Any
  future provider adapter must be introduced by a separate integration issue
  and keep a deterministic local fallback for tests.

## Future contributor rules

Future contributors may:

- add folder-local services, hooks, components, fixtures, tests, and docs;
- expand supported tones when tests and docs define deterministic behavior;
- add UI review states that operate on local props and local service results.

Future contributors may not:

- mount the tool in app routes or navigation;
- send, save, archive, delete, or persist emails;
- import from inbox, wallet, Stellar, database, authentication, or shared
  design-system internals;
- introduce live network calls, secrets, production data, or provider keys in
  this folder.

## Out of Scope

- sending emails;
- mutating mailbox state;
- adding routes, dashboard widgets, or navigation links;
- calling external AI providers from this folder;
- persisting rewrite history outside this folder.
