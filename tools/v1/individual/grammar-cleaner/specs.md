# Grammar Cleaner — Specs

## Purpose

Provide a self-contained grammar correction tool that accepts plain text input, analyzes it for grammar and writing issues, and returns corrected output with change annotations.

## Module Boundaries

```
tools/v1/individual/grammar-cleaner/
├── components/       UI layer — renders input, results, correction picker
├── services/         Pure logic — grammar checking, correction engine, text utilities
├── hooks/            React hooks — state management bridging components and services
├── tests/            Test files (unit, hook, service, integration scenarios)
├── docs/             Documentation (architecture, setup, contributing)
├── specs.md          This file — module contract and constraints
└── README.md         Folder overview and quick start
```

### Layer Responsibilities

| Layer         | Responsibility                                                | Owns                                                          |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `components/` | Render UI, emit user events, display results                  | UI state (cursor, selection, active correction)               |
| `hooks/`      | Orchestrate component ↔ service interaction, manage lifecycle | Interaction state (input text, processing status, result set) |
| `services/`   | Pure transformation logic, no side effects, no React imports  | Correction logic, text processing, diff computation           |
| `tests/`      | Validate all layers in isolation                              | Test scenarios, fixtures, assertions                          |
| `docs/`       | Developer documentation                                       | Architecture decisions, setup guide, contributor workflow     |

### Allowed Dependencies

```
components/ ──► hooks/ ──► services/  (one-way, no cycles)
                    │
                    └──► React primitives only (useState, useCallback, etc.)
```

- Components may import hooks. Components MUST NOT import services directly.
- Hooks may import services and React primitives. Hooks MUST NOT import components.
- Services MUST NOT import anything from hooks, components, or React.
- No layer may import from outside `tools/v1/individual/grammar-cleaner/`.

## Data Ownership Rules

| Data                        | Owner                            | Description                                         |
| --------------------------- | -------------------------------- | --------------------------------------------------- | ---------- | ---- | ----- |
| Raw input text              | Hook                             | Stored in local state, passed to services on demand |
| Processing status           | Hook                             | idle                                                | processing | done | error |
| Correction results          | Hook (cache) / Service (compute) | Service computes, hook caches for re-render         |
| Active correction choice    | Component                        | Which suggested correction the user selected        |
| Cursor / selection position | Component                        | Editor caret state, scoped to the input component   |

- Input and output data NEVER leaves the hook layer unless rendered by a component.
- Services are pure: given the same input string, they must return the same output every time.
- No data is persisted across sessions unless explicitly saved via a future export utility.

## Disallowed Dependencies

- No imports from app shell, routing, inbox, wallet core, Stellar core, or design system.
- No direct calls to the Stellar RPC, Horizon, or any blockchain endpoint.
- No imports from `src/` outside this folder.
- No global state (Redux, Zustand, React Context outside this tool).
- No `localStorage`, `sessionStorage`, or persistence layer unless explicitly added via a future integration issue.

## Hard Constraints

1. All code MUST live inside `tools/v1/individual/grammar-cleaner/`.
2. No routing — this tool renders inline or is mounted via props.
3. No authentication or user identity.
4. No network requests of any kind.
5. No dependency on inbox, mail, or messaging types.
6. No dependency on wallet, account, or Stellar types.
7. No dependency on design system components outside this folder.
8. All randomness MUST use a seeded deterministic function (see `mockHashHelpers.ts` pattern).
9. All generated text must be fake, public, and safe for open-source review.

## Future Integration Rules

When this tool is eventually integrated into a host (e.g., the demo admin dashboard or an inbox compose view):

- Integration must use **props only**: `<GrammarCleaner input={text} onComplete={handler} />`.
- Feature flags may gate availability, but the tool must not conditionally import host internals.
- The host passes raw text in; the tool returns corrected text with annotations out.
- No reverse dependency: the tool must not know about its host's types, routes, or state.

## Required Issue Categories

- Architecture — changes to module boundaries or dependency rules
- Feature — new correction capabilities or service logic
- UI and accessibility — component appearance, keyboard navigation, screen reader support
- Security and performance — input sanitization, large-text handling, memoization
- Testing and documentation — test plans, docs, manual validation checklists
