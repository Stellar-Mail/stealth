# Mail-to-Ticket Converter Architecture

## Folder Contract

The tool is a self-contained mini-product rooted at
`tools/v2/team/mail-to-ticket-converter/`. Its planned internal structure is:

```text
mail-to-ticket-converter/
|-- components/  # Presentational draft-review UI
|-- services/    # Pure conversion and validation logic
|-- hooks/       # Local orchestration between UI and services
|-- fixtures/    # Sanitized deterministic examples
|-- tests/       # Folder-local tests and test plans
|-- docs/        # Ownership and integration constraints
|-- types/       # Input, output, rule, and error contracts
|-- index.ts     # Future public entry point for this mini-product
|-- README.md
|-- specs.md
`-- ARCHITECTURE.md
```

Directories listed here are planned boundaries; this architecture issue does not
add runtime modules merely to populate them.

## Module Responsibilities

### Types

Owns serializable mail input, conversion rule, ticket draft, warning, and error
contracts. Types must not depend on React or provider SDKs.

### Services

Owns deterministic normalization, validation, and draft construction. Services
accept values through typed parameters and must not read application state or make
network calls.

### Hooks

Owns tool-local UI state and invokes services. Hooks may depend on React, local
types, and local services. They must not access global contexts or core stores.

### Components

Owns rendering and review interactions. Components consume props or local hooks;
they do not parse mail, persist data, or call external ticket APIs.

### Fixtures and Tests

Fixtures own sanitized, deterministic samples. Tests verify service contracts,
invalid inputs, mapping behavior, and component states without live dependencies.

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

A future main-app adapter may translate inbox data into the tool's input contract
and translate an approved draft into a provider request. That adapter must be
designed in a separate issue and remain outside this folder; it must not cause the
tool to own inbox, authentication, database, or provider state.
