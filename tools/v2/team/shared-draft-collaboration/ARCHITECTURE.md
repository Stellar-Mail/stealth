# Shared Draft Collaboration — Architecture Contract

## Ownership Boundary

**All work for this tool is isolated within:**

```
tools/v2/team/shared-draft-collaboration/
```

**Sacred constraints — these must NOT be modified by this issue or any follow-up PR:**

- Main application shell, dashboard layout, navigation system
- Main app routing (`src/router.tsx`, `src/routes/`)
- Inbox architecture, mail rendering engine
- Authentication and wallet core
- Stellar integration core
- Database schema and persistence
- Shared design system (`src/components/ui/`)
- Existing feature modules (`src/features/`)

This tool is a **self-contained V2 later-release tool**. Future integration with the main app is a separate issue.

---

## Module Architecture

### Folder Structure

```
tools/v2/team/shared-draft-collaboration/
├── index.ts                        # Public barrel export
├── types.ts                        # Type definitions
├── errors.ts                       # Error classes
├── specs.md                        # Feature specs and contracts
├── README.md                       # Tool overview
├── ARCHITECTURE.md                 # This file
├── services/
│   ├── draft.service.mjs           # Core service (ESM, Node-test compatible)
│   └── draft.service.ts            # Core service (TypeScript, Vitest compatible)
├── guards/
│   ├── draft-guards.mjs            # Input validation guards (ESM)
│   └── draft-guards.ts             # Input validation guards (TypeScript)
├── fixtures/
│   └── drafts.fixtures.mjs         # Deterministic seed data
├── tests/
│   └── shared-draft.test.mjs       # Node:test unit tests
├── docs/
│   ├── README.md                   # UI implementation docs
│   ├── review-notes.md             # Reviewer notes
│   ├── pr-body-safety.md           # PR body safety checklist
│   ├── security-and-performance.md # Security docs
│   └── ACCESSIBILITY.md            # WCAG 2.1 AA guide
└── components/
    ├── index.ts                    # Component barrel export
    ├── SharedDraftCollaboration.tsx
    ├── SharedDraftEmptyState.tsx
    ├── SharedDraftLoadingState.tsx
    ├── SharedDraftErrorState.tsx
    ├── SharedDraftList.tsx
    └── SharedDraftEntry.tsx
```

### Module Boundaries (Engine Layer)

#### 1. **types.ts** — Data Model

**Exports:**

- `SharedDraftData` — the core data entity
- `CreateDraftInput`, `UpdateDraftInput` — input contracts
- `DraftFilter` — filter query shape
- `DraftMetrics` — aggregated metrics shape
- `ServiceConfig` — service initialization config

**Rules:**

- Pure TypeScript types, no logic.
- All timestamps are ISO 8601 strings.
- `isActive` is a boolean flag for active/inactive state.

#### 2. **errors.ts** — Error Taxonomy

**Exports:**

- `DraftValidationError` — invalid input (includes `field` property)
- `DraftNotFoundError` — missing draft by id
- `DraftLimitError` — collection at capacity
- `DraftError` — union type for type guards

**Rules:**

- All errors are `instanceof` checkable.
- Error messages are human-readable and deterministic.

#### 3. **guards/draft-guards.ts** — Input Validation

**Exports:**

- `validateDraftId`, `validateDraftTitle`, `validateDraftSubject`
- `validateCollaboratorCount`, `validateSearchQuery`
- `guardDraftsCount`, `validateDraftInput`
- `sanitizeText` — strips HTML/script tags and control characters
- `LIMITS` — configurable boundary constants

**Rules:**

- All validation functions are pure and deterministic.
- Input sanitization prevents XSS and header injection.
- `validateDraftInput` validates the complete input object.

#### 4. **services/draft.service.ts** — Core Service

**Public Methods:**

| Method        | Input              | Output              | Errors                                       |
| ------------- | ------------------ | ------------------- | -------------------------------------------- |
| `getDrafts`   | `DraftFilter`      | `SharedDraftData[]` | None                                         |
| `addDraft`    | `CreateDraftInput` | `SharedDraftData`   | `DraftValidationError`, `DraftLimitError`    |
| `updateDraft` | `UpdateDraftInput` | `SharedDraftData`   | `DraftValidationError`, `DraftNotFoundError` |
| `removeDraft` | `DraftId`          | `void`              | `DraftValidationError`, `DraftNotFoundError` |
| `setActive`   | `DraftId`          | `SharedDraftData`   | `DraftValidationError`, `DraftNotFoundError` |
| `getMetrics`  | None               | `DraftMetrics`      | None                                         |

**Pure Helpers:**

| Function         | Input                   | Output              |
| ---------------- | ----------------------- | ------------------- |
| `computeMetrics` | `SharedDraftData[]`     | `DraftMetrics`      |
| `applyFilter`    | `drafts`, `DraftFilter` | `SharedDraftData[]` |

**Implementation Contract:**

- Storage: in-memory array — no persistence.
- All operations are async with configurable delay.
- Configurable delay via `config.delayMs` (default: 0).
- All returned data are copies, not internal references.
- No network calls, no database access.

#### 5. **index.ts** — Public Barrel Export

Exports all public types, errors, guards, service, and fixtures.

---

## Design Principles

1. **Pure Functions First** — All validation and filtering is pure and deterministic.
2. **Determinism** — Same input always produces same output.
3. **Security by Default** — Input sanitization prevents XSS, CRLF injection, and path traversal.
4. **Async by Contract** — All operations return Promises for UI loading state simulation.
5. **Isolation** — No modifications to files outside this folder.

---

## Testing Strategy

Tests in `tests/shared-draft.test.mjs` use Node's built-in `node:test` runner:

```bash
node --test tools/v2/team/shared-draft-collaboration/tests/shared-draft.test.mjs
```

### Coverage

| Category | Scenario                                                         |
| -------- | ---------------------------------------------------------------- |
| Fixtures | Correct count, required fields                                   |
| Metrics  | Totals, active/inactive, collaborators                           |
| Filter   | isActive, search, combined                                       |
| Service  | CRUD, validation, not-found, state tracking                      |
| Security | XSS sanitization, CRLF blocking, path traversal, oversized input |
