# Knowledge Base Suggestion Architecture

## Folder Contract

The tool is a self-contained mini-product rooted at
`tools/v2/team/knowledge-base-suggestion/`.

```text
knowledge-base-suggestion/
|-- core/
|   `-- engine.ts      # Modular core: scoring, filtering, ranking
|-- services/          # Service layer orchestrating the core
|-- fixtures/          # Deterministic examples and corpus filters
|-- tests/             # Folder-local tests
|-- docs/              # Ownership, constraints, and contributor guidance
|-- types.ts           # Domain types
|-- index.ts           # Public folder-local entry point
|-- README.md
|-- specs.md
`-- ARCHITECTURE.md
```

## Module Responsibilities

### Types

Owns serializable domain contracts: `KbArticle`, `KbSuggestion`, `SuggestInput`,
`KbMatchReason`, `KbCorpusFilter`, `KbCorpusFilterResult`.

### Core Engine

Owns deterministic validation, eligibility filtering, scoring with explainable
match reasons, ranking, and input normalization. The core is pure and
presentation-free, and does not import from any application context.

### Services

Owns the `KbContract` execution boundary. Delegates to the core engine and
returns typed `KbResult<T>` outcomes.

### Fixtures and Tests

Fixtures own sanitized, deterministic KB corpora and corpus filters. Tests verify
core modules, contract behavior, ranking, tie-breaking, filtering, warnings, and
edge cases without live dependencies.

## Dependency Direction

```text
services -> core -> types
tests ------------------> local modules
fixtures -----------------> tests
```

Dependencies must flow inward. Core cannot import services, and no module may
import from the main application.

## Expansion Points

- Add new `KbMatchReason` variants in `core/engine.ts` and `types.ts`.
- Add new `KbCorpusFilter` implementations in `fixtures.ts` or future files.
- Add secondary sort criteria in `rankArticles`.
- Add new validation rules in `validateInput`.
- Add new contract operations in `core/engine.ts` and expose them via `KbContract`.
- Future folder-local hooks/components may consume the contract but must not touch the main app.
