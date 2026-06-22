# Customer Support Macro Tool — Architecture Contract

This document defines the folder-local architecture for the Customer Support
Macro Tool. It is scoped only to
`tools/v1/team/customer-support-macro-tool/` and does not wire the tool into the
main app.

## Module map

| Module | Owns | May depend on | Must not depend on |
| --- | --- | --- | --- |
| `services/macro.service.ts` | Macro data model, validation, CRUD, search, sorting, usage tracking, interpolation | Local types and pure helpers | React, storage, network calls, main app imports |
| `services/storage.service.ts` | Storage adapter interface, localStorage adapter, in-memory adapter, load/save/clear helpers | `Macro` type from the macro service | Main app persistence, database, auth/session state |
| `hooks/useMacros.ts` | React state wrapper over services and storage adapters | Local services, local fixtures via caller options | App shell, routing, inbox, wallet, Stellar, design system |
| `fixtures/macros.fixture.ts` | Synthetic macro examples for tests and local development | Local macro types | Production ticket data, customer data, live mail |
| `tests/` | Service, storage, and future hook/component coverage | Local modules and fixtures | Live storage services, production data, app-level mocks |
| `docs/` | Setup, review notes, architecture, future handoff | Local file references | Integration promises outside the issue scope |
| `components/` | Reserved for the UI/accessibility issue | Local hooks, local props, local fixtures | Main app shell, shared design-system internals |

## Data ownership

This folder owns only the data needed to create and apply reusable support
macros:

- macro id, title, body, category, tags, timestamps, usage count, favorite flag;
- macro create/update/search/sort inputs;
- variable interpolation maps for `{{snake_case}}` placeholders;
- local storage adapter payloads;
- synthetic fixtures and test-only data.

The following data remains outside this folder and must not be read or mutated
here:

- live inbox messages and threads;
- production customer tickets;
- authenticated user/session state;
- wallet or Stellar account state;
- database records;
- analytics and telemetry;
- app routes, navigation, and shell layout;
- shared design-system state.

## Dependency rules

- Services must remain pure unless the file is explicitly a storage adapter.
- `macro.service.ts` must not import React, storage adapters, `src/`, or browser
  globals.
- `storage.service.ts` owns persistence boundaries and must expose adapter-based
  helpers so tests can use `createInMemoryAdapter`.
- `useMacros.ts` may compose local services and a provided `StorageAdapter`, but
  must not import from the app shell, inbox, routing, wallet, Stellar, database,
  or design system.
- Future components should receive data and callbacks through local props and
  hooks. They should not mutate mail, send replies, or mount themselves into
  app navigation.
- Tests must use local fixtures and adapters. They must not require live
  browser storage, network access, production tickets, or real customer data.

## Public API shape

Future consumers should treat these as the stable folder-local surfaces:

- Pure service functions: `createMacro`, `updateMacro`, `deleteMacro`,
  `recordMacroUsage`, `searchMacros`, `sortMacros`, `extractVariables`,
  `interpolateMacro`, and `validateMacroInput`.
- Storage helpers: `loadMacros`, `saveMacros`, `clearMacros`,
  `createInMemoryAdapter`, and `StorageAdapter`.
- React hook: `useMacros({ storageAdapter, seedMacros })`.
- Fixture entry points: `FIXTURE_MACROS`, `FIXTURE_MACRO_NO_VARS`, and
  `FIXTURE_MACRO_WITH_VARS`.

## Allowed future changes

Future contributors may add:

- local UI components for macro listing, editing, variable prompts, and apply
  flows;
- local hook tests once the repository adds the required testing utilities;
- additional categories or validation rules when tests and docs cover them;
- folder-local docs for UI states, accessibility, and review flows.

## Forbidden future changes without a separate integration issue

Future contributors must not:

- mount this tool into app routes, dashboard navigation, compose surfaces, or
  inbox panels;
- send email, write to production tickets, mutate mailbox state, or call live
  support APIs;
- import from the main app shell, routing, inbox, wallet, Stellar, database,
  authentication, analytics, or shared design-system internals;
- add live network calls, secrets, provider keys, production customer data, or
  private ticket content;
- replace the storage adapter boundary with direct app persistence.

## Review checklist

- All modified files are under `tools/v1/team/customer-support-macro-tool/`.
- Service changes have local unit tests.
- Storage changes can run with `createInMemoryAdapter`.
- UI changes, if any, remain unmounted and folder-local.
- No live network calls, secrets, provider keys, production data, or app-level
  mutations were added.
- Any future integration need is documented as follow-up work instead of being
  implemented here.
