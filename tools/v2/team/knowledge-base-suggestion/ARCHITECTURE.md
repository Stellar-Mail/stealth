# Knowledge Base Suggestion Architecture

## Folder Contract

The tool is a self-contained mini-product rooted at
`tools/v2/team/knowledge-base-suggestion/`. Its planned internal structure is:

```text
knowledge-base-suggestion/
|-- components/  # Presentational suggestion UI
|-- services/    # Pure filtering and ranking logic
|-- hooks/       # Local orchestration between UI and services
|-- fixtures/    # Sanitized deterministic examples
|-- tests/       # Folder-local tests and test plans
|-- docs/        # Ownership and integration constraints
|-- types/       # Context, article, result, and error contracts
|-- index.ts     # Future public entry point for this mini-product
|-- README.md
|-- specs.md
`-- ARCHITECTURE.md
```

Directories listed here are planned boundaries; this architecture issue does not
add runtime modules merely to populate them.

## Module Responsibilities

### Types

Owns serializable mail context, article snapshot, ranking configuration, suggestion,
and error contracts. Types must not depend on React or provider SDKs.

### Services

Owns deterministic validation, eligibility filtering, scoring, ordering, and match
explanations. Services accept snapshots through typed parameters and must not read
application state or make network calls.

### Hooks

Owns tool-local loading and selection state and invokes services. Hooks may depend
on React, local types, and local services. They must not access global contexts or
core stores.

### Components

Owns rendering of suggestions, reasons, empty states, and errors. Components
consume props or local hooks; they do not query article providers or mutate mail.

### Fixtures and Tests

Fixtures own sanitized, deterministic mail contexts and article snapshots. Tests
verify contracts, filtering, ordering, tie-breaking, and component states without
live dependencies.

### Docs

Owns architectural decisions, data ownership, integration constraints, and future
contributor guidance.

## Dependency Direction

```text
components -> hooks -> services -> types
tests ---------------------------> local modules
fixtures ------------------------> tests and demos
```

Dependencies must flow inward. Services cannot import hooks or components, and no
module may import from the main application.

## Future Integration Boundary

A future consumer-owned adapter may provide authorized article snapshots and a
normalized mail context, then display selected suggestions in the main app. That
adapter requires a separate issue and remains responsible for authentication,
permissions, provider access, inbox state, and content insertion.
