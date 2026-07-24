# Shared Draft Collaboration Specs

## Purpose

Collaborative drafting tool that enables team members to create, edit, and manage shared email drafts together.

## Ownership Boundary

All work for this tool must stay inside:

```
tools/v2/team/shared-draft-collaboration/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Input Contracts

### CreateDraftInput

```ts
type CreateDraftInput = {
  title: string; // required, max 120 chars
  subject?: string; // optional, max 200 chars
  collaborators?: number; // optional, defaults to 1, max 50
};
```

### UpdateDraftInput

```ts
type UpdateDraftInput = {
  id: string; // required, alphanumeric + hyphens/underscores
  title?: string; // optional partial update
  subject?: string; // optional partial update
  collaborators?: number; // optional partial update
};
```

## Output Contracts

### SharedDraftData

```ts
type SharedDraftData = {
  id: string;
  title: string;
  subject: string;
  lastModified: string; // ISO 8601
  collaborators: number;
  isActive: boolean;
};
```

### DraftMetrics

```ts
type DraftMetrics = {
  total: number;
  active: number;
  inactive: number;
  totalCollaborators: number;
};
```

## Errors

| Error                  | Condition               | Shape                  |
| ---------------------- | ----------------------- | ---------------------- |
| `DraftValidationError` | Input fails validation  | `{ message, field }`   |
| `DraftNotFoundError`   | Draft id does not exist | `{ message, draftId }` |
| `DraftLimitError`      | Collection at capacity  | `{ message, limit }`   |

## Service Operations

| Operation     | Input                    | Output              | Errors                                       |
| ------------- | ------------------------ | ------------------- | -------------------------------------------- |
| `getDrafts`   | `DraftFilter` (optional) | `SharedDraftData[]` | None                                         |
| `addDraft`    | `CreateDraftInput`       | `SharedDraftData`   | `DraftValidationError`, `DraftLimitError`    |
| `updateDraft` | `UpdateDraftInput`       | `SharedDraftData`   | `DraftValidationError`, `DraftNotFoundError` |
| `removeDraft` | `DraftId`                | `void`              | `DraftValidationError`, `DraftNotFoundError` |
| `setActive`   | `DraftId`                | `SharedDraftData`   | `DraftValidationError`, `DraftNotFoundError` |
| `getMetrics`  | None                     | `DraftMetrics`      | None                                         |

## Loading States

All service operations return Promises. The configurable `delayMs` in `ServiceConfig` allows UI layers to simulate realistic loading durations:

- `delayMs: 0` — resolves on microtask tick (for tests)
- `delayMs > 0` — simulates network latency (for UI development)

## Filter Semantics

```ts
type DraftFilter = {
  isActive?: boolean; // filter by active/inactive status
  search?: string | null; // case-insensitive title/subject search
};
```

- `isActive` and `search` can be combined (AND logic).
- Empty/missing filter returns all drafts.

## Security

- HTML tags stripped from all text inputs (XSS prevention).
- CRLF characters removed (header injection prevention).
- Null bytes removed.
- Draft IDs restricted to alphanumeric, hyphen, and underscore.
- Maximum drafts limited to 1000 entries.

## Test Fixtures

Fixture data in `fixtures/drafts.fixtures.mjs` covers:

- 4 fixture drafts (2 active, 2 inactive)
- Various collaborator counts (1-4)
- ISO 8601 timestamps
- All fixtures have required fields

## Contributor Boundary

### What Contributors Can Change

✅ **Allowed:**

- Add new tests to `tests/shared-draft.test.mjs`
- Add new fixtures to `fixtures/drafts.fixtures.mjs`
- Update error messages in `errors.ts` (same error types)
- Optimize service internals (same public API)
- Update documentation (`*.md` files in this folder)

### What Contributors Cannot Change

❌ **Not allowed:**

- Modify public method signatures in the service
- Add new error types without prior issue discussion
- Change data type shapes in `types.ts`
- Import from `src/` or other tool folders
- Modify main app files (`src/`, `routes/`, `components/`, etc.)
- Add external npm dependencies
- Wire this tool into main app routing or shell
