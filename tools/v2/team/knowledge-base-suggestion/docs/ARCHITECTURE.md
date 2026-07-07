# Knowledge Base Suggestion Architecture Contract

## Purpose

Knowledge Base Suggestion is a self-contained V2 team mini-product. It helps a
team identify repeated support questions, policy gaps, and workflow patterns
that may deserve internal documentation. The architecture keeps suggestion
logic local to this folder and leaves main-app wiring for a future integration
issue.

## Ownership Boundary

All implementation, fixtures, tests, and docs for this tool must remain inside:

```text
tools/v2/team/knowledge-base-suggestion/
```

No file outside this folder is required for this architecture issue.

## Module Boundaries

### `components/`

Responsibility: render the review surface for suggestion candidates.

Planned components:

- `KnowledgeBaseSuggestionShell`: local root component that receives candidate
  inputs or fixture data and coordinates the review surface.
- `SuggestionCandidateList`: renders candidate article ideas, confidence, and
  status.
- `SuggestionEvidencePanel`: shows the local evidence summary that supports a
  candidate without exposing production email bodies.
- `SuggestionReviewActions`: presents reviewer actions such as accept, defer,
  reject, or mark-needs-more-evidence.

Rules:

- Components receive data from hooks or props.
- Components do not read the inbox, database, wallet, Stellar, or auth state.
- Components do not mutate production knowledge base records.

### `services/`

Responsibility: hold pure business logic and deterministic helpers.

Planned services:

- `suggestionDetector`: groups repeated themes and identifies candidate
  knowledge base topics.
- `suggestionScorer`: computes local confidence and evidence strength.
- `suggestionNormalizer`: converts local input records into a consistent
  candidate shape for the UI.
- `reviewStateService`: models local reviewer states and transition rules.

Rules:

- Services do not import React.
- Services do not make live network calls.
- Services use injected data or local fixtures instead of fetching from the
  main app.

### `hooks/`

Responsibility: bridge component state to local services.

Planned hooks:

- `useKnowledgeBaseSuggestions`: manages candidate loading, filtering, review
  state, and service calls.
- `useSuggestionFilters`: owns local filter state for department, status,
  confidence, and topic area.
- `useSuggestionReview`: exposes local reviewer actions without publishing or
  persisting records outside this folder.

Rules:

- Hooks call services instead of duplicating business logic.
- Hooks do not write to global stores or app contexts.
- Hooks do not register routes, navigation items, or mail actions.

### `tests/`

Responsibility: provide local confidence without requiring the main app.

Expected coverage:

- Architecture and documentation contract tests.
- Service tests for grouping, scoring, normalization, and review transitions.
- Fixture tests proving all sample data is synthetic.
- Hook and component tests after implementation exists.

Rules:

- Tests must stay folder-local.
- Tests may use local fixtures and standard test utilities already present in
  the repository.
- Tests must not require a live inbox, production database, wallet, Stellar
  account, or external knowledge base service.

### `docs/`

Responsibility: explain the tool contract for future contributors.

Expected contents:

- Architecture and dependency boundaries.
- Data ownership and privacy rules.
- Review notes and test plans for future implementation issues.
- Future integration notes that describe, but do not implement, app wiring.

## Dependency Graph

```text
components/ -> hooks/ -> services/
tests/ -> docs/, fixtures/, components/, hooks/, services/
docs/ -> descriptive only
```

Components should not import services directly once hooks exist. Services should
not import components or hooks. Docs should not be imported at runtime.

## Integration Constraints

This architecture issue must not:

- Modify the main app shell, dashboard, routing, navigation, or shared layout.
- Connect to the existing inbox architecture or mail rendering engine.
- Add database schema, persistence, or production knowledge base writes.
- Add authentication, wallet, Stellar, or payment behavior.
- Add notifications, ticketing sync, or external provider calls.
- Change the shared design system.

Future integration should pass prepared evidence and callbacks into the
folder-local shell through a thin adapter. The tool should remain the source of
truth for suggestion logic, while the main app owns routing, authorization, live
mail access, persistence, and publishing.

## Contributor Rules

May change inside this folder:

- Local components, services, hooks, tests, fixtures, and docs.
- Internal types and local data contracts.
- Architecture docs when module boundaries evolve.

Must not change in this issue:

- Files outside `tools/v2/team/knowledge-base-suggestion/`.
- Main app shell, routing, inbox, wallet, Stellar, auth, database, or shared
  design-system code.
- Production data access, production knowledge base publishing, or live network
  integrations.
