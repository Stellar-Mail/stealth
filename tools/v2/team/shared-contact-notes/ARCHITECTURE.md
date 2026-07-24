# Shared Contact Notes — Architecture Contract

## Ownership Boundary

**All work for this tool is isolated within:**

```
tools/v2/team/shared-contact-notes/
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
tools/v2/team/shared-contact-notes/
├── index.ts                    # Public barrel export
├── types.ts                    # Type definitions
├── errors.ts                   # Error classes
├── validation.ts               # Pure validation functions
├── service.ts                  # NoteService (core business logic)
├── README.md                   # Tool overview
├── ARCHITECTURE.md             # This file
├── specs.md                    # Feature specs and contracts
├── components/
│   ├── index.ts                # Component barrel export
│   ├── SharedContactNotes.tsx  # Main state machine component
│   ├── ContactNotesEmptyState.tsx
│   ├── ContactNotesLoadingState.tsx
│   ├── ContactNotesErrorState.tsx
│   ├── ContactNotesList.tsx    # List with active/archived sections
│   ├── ContactNoteEntry.tsx    # Individual note card
│   └── ContactNoteForm.tsx     # Create/edit form with validation
├── hooks/
│   └── useContactNotes.ts      # useReducer-based hook wrapping NoteService
├── docs/
│   ├── review-notes.md         # Reviewer checklist
│   └── ACCESSIBILITY.md        # WCAG 2.1 AA compliance documentation
├── fixtures/
│   └── notes.ts                # Seed data for tests
└── tests/
    ├── service.test.ts         # Vitest unit tests (service layer)
    ├── components.test.tsx     # Vitest component tests (UI layer)
    └── test-plan.md            # Test coverage documentation
```

### Module Boundaries

#### 1. **types.ts** — Data Model

**Responsibility:** Define all data shapes and input/output contracts.

**Exports:**

- `Note` — the core data entity
- `CreateNoteInput`, `UpdateNoteInput` — input contracts
- `ServiceConfig` — service initialization config
- Type aliases: `NoteId`, `ContactId`, `AuthorId`

**Rules:**

- Pure TypeScript types, no logic.
- All fields are required unless explicitly `| null`.
- Timestamps are ISO 8601 strings (not Date objects).
- Archive state is tracked via `archivedAt: string | null`.
- Do not add references to main app types or services.

---

#### 2. **errors.ts** — Error Handling

**Responsibility:** Define deterministic, recoverable error types.

**Exports:**

- `ValidationError` — invalid input (failed validation)
- `NoteNotFoundError` — missing note by id
- `NoteError` — union type for type guards

**Error Shape Rules:**

- `ValidationError` includes a `fields` array with `{ field, message }` tuples.
- `NoteNotFoundError` includes the `noteId` that was not found.
- All errors are `instanceof` checkable.
- Error messages are human-readable and deterministic.

**Rules:**

- Do not throw generic Error — use specific error types only.
- All error shapes are serializable (no circular references, no functions).
- Do not add authorization errors (not in scope for V2 release).

---

#### 3. **validation.ts** — Input Validation

**Responsibility:** Provide pure, deterministic validation functions.

**Exports:**

- `validateCreateNote(input: CreateNoteInput): ValidationError | null`
- `validateUpdateNote(input: UpdateNoteInput): ValidationError | null`

**Validation Rules:**

- `contactId`, `content`, `authorId` must not be empty strings or whitespace-only.
- `content` must have meaningful length (no single character).
- All error results are deterministic — same input always produces same errors.
- Validation functions are pure (no side effects).
- Do not validate against a persistent store (no id uniqueness checks).

**Rules:**

- Do not add async validation.
- Do not add business logic beyond field validation.
- All validation failures must map to specific field paths.

---

#### 4. **service.ts** — NoteService Class

**Responsibility:** Implement all CRUD operations and state management.

**Public Methods:**

- `create(input: CreateNoteInput): Promise<Note>`
- `getByContact(contactId: ContactId): Promise<Note[]>`
- `getById(id: NoteId): Promise<Note>`
- `update(id: NoteId, input: UpdateNoteInput): Promise<Note>`
- `delete(id: NoteId): Promise<void>`
- `archive(id: NoteId): Promise<Note>`

**Constructor:**

```ts
constructor(seedNotes?: Note[], config?: Partial<ServiceConfig>)
```

**Implementation Contract:**

- Storage: in-memory `Map<NoteId, Note>` — no persistence.
- All operations are async, always return Promises.
- Configurable delay via `config.delayMs` (default: 0).
- With `delayMs: 0`, operations resolve on microtask tick (for tests).
- With `delayMs > 0`, operations simulate realistic latency (for UI development).
- All returned notes are copies, not internal references.
- No network calls, no database access, no side effects outside the store.

**Rules:**

- Do not add authentication or authorization checks.
- Do not add multi-user conflict resolution or locking.
- Do not add real-time sync or WebSocket listeners.
- Do not integrate with main app services or stores.
- State mutations are private — only expose copies via method returns.

---

#### 5. **index.ts** — Public Barrel Export

**Responsibility:** Define the public API surface.

**What is exported:**

- `NoteService` class
- `Note`, `CreateNoteInput`, `UpdateNoteInput`, `ServiceConfig` types
- `ValidationError`, `NoteNotFoundError` error classes
- `validateCreateNote`, `validateUpdateNote` functions

**What is NOT exported:**

- Internal validation helpers or utilities.
- Private service methods.
- Seeding or fixture functions (not part of public API).

**Rules:**

- All public exports are documented via TypeScript types.
- Do not re-export from external libraries.
- This is the only file external consumers should import from.

---

#### 6. **hooks/useContactNotes.ts** — React Hook

**Responsibility:** Bridge the `NoteService` with React state management.

**Exports:**

- `useContactNotes(contactId, service, initialLoad?)` — Returns `{ status, notes, error, loadNotes, createNote, updateNote, deleteNote, archiveNote }`

**State Machine:**

| Status    | Meaning                        |
| --------- | ------------------------------ |
| `idle`    | Initial state, no load started |
| `loading` | Fetch in progress              |
| `success` | Data loaded successfully       |
| `error`   | Fetch failed                   |

**Rules:**

- Uses `useReducer` with a discriminated union of action types.
- All mutations dispatch optimistically after service confirms.
- Cleanup via `mountedRef` prevents state updates on unmounted components.
- Does not import from `src/` or other tool folders.

---

#### 7. **components/** — React UI Layer

**Responsibility:** Render all UI states with full accessibility support.

**Components:**

| Component                  | Role             | States Handled        |
| -------------------------- | ---------------- | --------------------- |
| `SharedContactNotes`       | Main container   | loading/error/success |
| `ContactNotesLoadingState` | Skeleton loader  | `aria-busy="true"`    |
| `ContactNotesErrorState`   | Error display    | `role="alert"`        |
| `ContactNotesEmptyState`   | Empty state CTA  | `role="status"`       |
| `ContactNotesList`         | Note list        | Active/Archived split |
| `ContactNoteEntry`         | Individual note  | Edit/Archive/Delete   |
| `ContactNoteForm`          | Create/Edit form | Inline validation     |

**Rules:**

- All interactive elements have `aria-label`, focus behavior, and keyboard support.
- Components import UI primitives from `../../../../src/components/ui/` (shared shadcn/ui library).
- No modification of the shared design system.
- No main app shell or routing dependencies.

---

### Data Ownership

#### Responsibilities

| Module                     | Owns            | Responsible For                         |
| -------------------------- | --------------- | --------------------------------------- |
| `types.ts`                 | Data shapes     | Defining all contracts                  |
| `errors.ts`                | Error taxonomy  | Error creation and serialization        |
| `validation.ts`            | Input rules     | Validating user input                   |
| `service.ts`               | In-memory store | CRUD operations, state consistency      |
| `hooks/useContactNotes.ts` | React state     | Bridging service to UI state management |
| `components/`              | UI rendering    | All UI states and accessibility         |
| `fixtures/notes.ts`        | Test data       | Providing deterministic seed data       |
| `tests/`                   | Test coverage   | Validating all contract guarantees      |

#### Data Flow

**Engine Layer:**

```
External Input
    ↓
[validation.ts] — pure validation, no side effects
    ↓
[service.ts] — CRUD operation, store mutation
    ↓
Internal Store (Map<NoteId, Note>)
    ↓
[service.ts] — copy data before returning
    ↓
External Output (Promise<Note> or Promise<void>)
```

**UI Layer:**

```
[useContactNotes hook]
    ─ calls service methods ─→ [NoteService] ─→ Promise<Note[]>
    ← dispatches action ───── [useReducer]  ─→ new state
         ↓
[SharedContactNotes] renders based on status:
    loading  → ContactNotesLoadingState
    error    → ContactNotesErrorState
    success
      ─ empty → ContactNotesEmptyState
      ─ data  → ContactNotesList → ContactNoteEntry
    create/edit → ContactNoteForm
```

---

### Dependencies

#### Internal Dependencies (within this folder)

```
service.ts
  ├─→ types.ts (imports data types)
  ├─→ errors.ts (throws error classes)
  └─→ validation.ts (calls validation functions)

validation.ts
  ├─→ types.ts (imports input types)
  └─→ errors.ts (returns ValidationError)

index.ts
  ├─→ service.ts (re-exports NoteService)
  ├─→ types.ts (re-exports data types)
  ├─→ errors.ts (re-exports error classes)
  └─→ validation.ts (re-exports validators)

hooks/useContactNotes.ts
  ├─→ service.ts (calls NoteService methods)
  ├─→ types.ts (imports Note, CreateNoteInput, etc.)
  └─→ errors.ts (handles NoteError type)

components/SharedContactNotes.tsx
  ├─→ hooks/useContactNotes.ts (state management)
  ├─→ service.ts (instantiates NoteService)
  ├─→ fixtures/notes.ts (default seed data)
  └─→ components/* (renders child components)

tests/service.test.ts
  ├─→ service.ts (tests NoteService)
  ├─→ types.ts (types for test data)
  ├─→ errors.ts (expects error types)
  └─→ fixtures/notes.ts (seeds test data)

tests/components.test.tsx
  ├─→ components/SharedContactNotes.tsx (renders component)
  ├─→ service.ts (instantiates NoteService)
  └─→ fixtures/notes.ts (seeds test data)
```

#### External Dependencies

**Allowed (Engine Layer):**

- TypeScript (type system only)
- `crypto.randomUUID()` (native Web API for id generation)

**Allowed (UI Layer):**

- React 19 (`useState`, `useReducer`, `useCallback`, `useEffect`, `useRef`)
- Shared shadcn/ui components from `../../../../src/components/ui/`
- `lucide-react` icons
- `@testing-library/react` and `@testing-library/user-event` (test only)

**Not allowed:**

- Main app feature imports (`src/features/`, `src/hooks/`, `src/stores/`)
- External npm libraries beyond those already in the project
- Network or persistence libraries
- Modification of `src/components/ui/` or shared design system

---

### Integration Constraints

#### What This Tool Cannot Do (by design)

1. **No persistence** — in-memory only.
2. **No authentication** — caller is trusted.
3. **No authorization** — all callers see all notes.
4. **No database schema** — no schema dependencies.
5. **No UI components** — no React, no markup, pure engine.
6. **No main app integration** — isolated tool.
7. **No Stellar interaction** — no wallet, no blockchain.
8. **No real-time features** — no WebSocket, no server push.

#### Future Integration Points (separate issue)

A future UI integration issue may add:

- **React components** (`components/NoteList.tsx`, `components/NoteEditor.tsx`)

  - Location: `tools/v2/team/shared-contact-notes/components/`
  - Imports: `service.ts`, `types.ts`
  - No modification of main app shell or routing

- **React hooks** (`hooks/useContactNotes.ts`)

  - Location: `tools/v2/team/shared-contact-notes/hooks/`
  - Wraps `NoteService` with React state management
  - Pure hook, no main app dependencies

- **Persistence layer** (`services/storage.ts`)

  - Location: `tools/v2/team/shared-contact-notes/services/`
  - Syncs in-memory store to storage or API
  - Does not modify main app storage schema

- **Integration with contact detail panel**
  - Defined in a separate feature issue
  - Connects this tool to the main mail app UI
  - No changes to main app routing or shell

---

## Design Principles

### 1. Pure Functions First

- All validation is pure (deterministic, no side effects).
- All error shapes are serializable.
- All data is copied before being returned.

### 2. Determinism

- Same input always produces same output.
- Seeded services with identical data produce identical results.
- All async operations respect configurable delay.

### 3. No Hidden Dependencies

- No globals, no singletons.
- No hidden imports from main app.
- All dependencies are explicit.

### 4. Async by Contract

- All operations return `Promise`, even if synchronous internally.
- Callers can always `await` without surprise throws.
- Loading states are observable via Promise lifecycle.

### 5. Isolation

- No modifications to files outside this folder.
- No imports from `src/` or other tool folders.
- Self-contained, copy-paste-able mini-product.

---

## Testing Strategy

### Fixture-Based Testing

- All tests use deterministic seed data from `fixtures/notes.ts`.
- Fixtures include edge cases (archived notes, multiple notes per contact, etc.).
- Same fixtures used in all test suites.

### Coverage

| Category           | Scenario                                      | Test File         |
| ------------------ | --------------------------------------------- | ----------------- |
| CRUD               | Create, read, update, delete, archive         | `service.test.ts` |
| Validation         | Empty fields, missing fields, multiple errors | `service.test.ts` |
| Error handling     | Not-found errors, validation errors           | `service.test.ts` |
| Determinism        | Same input → same output                      | `service.test.ts` |
| Mutation isolation | Returned data is copies                       | `service.test.ts` |
| Loading state      | Async behavior with configurable delay        | `service.test.ts` |

### Test Execution

```bash
# Run all tests
npx vitest run tools/v2/team/shared-contact-notes/tests/service.test.ts

# Watch mode
npx vitest --watch tools/v2/team/shared-contact-notes/tests/service.test.ts
```

---

## Contribution Guidelines

### What Contributors Can Change

✅ **Allowed:**

- Add new tests to `tests/service.test.ts` (same test file).
- Add new fixtures to `fixtures/notes.ts`.
- Update error messages in `errors.ts` (same error types).
- Optimize `service.ts` internals (same public API).
- Update documentation (`*.md` files in this folder).
- Add developer utilities to `tests/` only.

### What Contributors Cannot Change

❌ **Not allowed:**

- Modify public method signatures in `service.ts`.
- Add new error types without prior issue discussion.
- Change data type shapes in `types.ts`.
- Import from `src/` or other tool folders.
- Modify main app files (`src/`, `routes/`, `components/`, etc.).
- Add external npm dependencies.
- Add authentication, authorization, or persistence (deferred to future issues).
- Wire this tool into main app routing or shell (deferred to separate issue).

### Code Review Checklist

Reviewers must verify:

- [ ] All changes are within `tools/v2/team/shared-contact-notes/`
- [ ] No imports from `src/` or other folders
- [ ] No new external npm dependencies
- [ ] Public API (method signatures, error types) unchanged
- [ ] All tests pass: `npx vitest run`
- [ ] Documentation is updated (`ARCHITECTURE.md`, specs, test-plan)
- [ ] Error handling is deterministic
- [ ] Returned data is always copies, never internal references
- [ ] No main app side effects

---

## Acceptance Criteria Checklist

- ✅ Tool has a clear folder-local architecture plan (this document)
- ✅ Issue work does not modify main app shell, routing, inbox, wallet, Stellar, or design system
- ✅ Specs explain what future contributors may and may not change (see above)
- ✅ Files changed by this issue are limited to `tools/v2/team/shared-contact-notes/`
- ✅ Contribution is reviewable as a self-contained mini-product

---

## File Ownership Map

| File                    | Module           | Owner        | Type      |
| ----------------------- | ---------------- | ------------ | --------- |
| `types.ts`              | Data Model       | Service Team | Stable    |
| `errors.ts`             | Error Handling   | Service Team | Stable    |
| `validation.ts`         | Input Validation | Service Team | Stable    |
| `service.ts`            | Core Service     | Service Team | Stable    |
| `index.ts`              | Public API       | Service Team | Stable    |
| `specs.md`              | Specification    | Service Team | Reference |
| `ARCHITECTURE.md`       | Architecture     | Service Team | Reference |
| `README.md`             | Overview         | Service Team | Reference |
| `docs/review-notes.md`  | Review Guide     | Service Team | Reference |
| `fixtures/notes.ts`     | Test Data        | QA Team      | Mutable   |
| `tests/service.test.ts` | Test Suite       | QA Team      | Mutable   |
| `tests/test-plan.md`    | Test Plan        | QA Team      | Reference |

---

## Version History

| Date       | Status  | Notes                                        |
| ---------- | ------- | -------------------------------------------- |
| 2026-06-20 | Initial | Created architecture contract for V2 release |
