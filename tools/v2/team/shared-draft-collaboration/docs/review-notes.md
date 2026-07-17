# Review Notes — Shared Draft Collaboration

## How to review this tool independently

This folder is fully self-contained. No main app setup is required.

### Run the tests

```bash
node --test tools/v2/team/shared-draft-collaboration/tests/shared-draft.test.mjs
```

Expected output: **25 tests pass, 0 fail**.

### What is tested

| Suite            | Coverage                                                                                |
| ---------------- | --------------------------------------------------------------------------------------- |
| Fixtures         | Shape validation, active/inactive counts                                                |
| `computeMetrics` | totals, collaborator sum, empty list, single entry                                      |
| `applyFilter`    | isActive, search (title + subject), combined filters                                    |
| Service          | getDrafts, addDraft, updateDraft, removeDraft, setActive, getMetrics, mutation tracking |

### Files changed in this issue

```
tools/v2/team/shared-draft-collaboration/
├── fixtures/drafts.fixtures.mjs   ← 4 deterministic drafts
├── services/draft.service.mjs     ← pure service factory (no network)
├── tests/shared-draft.test.mjs    ← 25 node:test cases
└── docs/review-notes.md           ← this file
```

### Inputs and outputs

**`createDraftService(initialDrafts?)`**

| Method               | Input                                 | Output                                            | Error state            |
| -------------------- | ------------------------------------- | ------------------------------------------------- | ---------------------- |
| `getDrafts(filter?)` | `{ isActive?, search? }`              | `SharedDraftData[]`                               | —                      |
| `addDraft(input)`    | `{ title, subject?, collaborators? }` | `SharedDraftData`                                 | —                      |
| `updateDraft(input)` | `{ id, ...fields }`                   | `SharedDraftData`                                 | throws if id not found |
| `removeDraft(id)`    | `string`                              | `void`                                            | throws if id not found |
| `setActive(id)`      | `string`                              | `SharedDraftData`                                 | throws if id not found |
| `getMetrics()`       | —                                     | `{ total, active, inactive, totalCollaborators }` | —                      |

### Known limitations

- State is in-memory only; resets on each `createDraftService()` call.
- No real-time collaboration (websocket/CRDT) — that requires a future integration issue.
- UI components import from `src/components/ui/` (shared Radix/Tailwind primitives); the service layer has zero main-app dependencies.

### Integration note

Do **not** wire this into the main app in this PR. If real-time or persistence is needed, open a follow-up issue.
