# Draft Dataset Store

Feature-local state management for editing a **dataset of drafts** (the collection
a maintainer curates before publishing it to the demo UI). This complements the
existing single-draft `draftReducer` (`reducers/draftReducer.ts`), which tracks one
`current` draft, by managing the full working collection.

Everything here is deterministic, fake, and confined to
`src/features/demo-admin-dashboard/`.

## Pieces

- `types/draftDataset.ts` — `DraftDatasetState` and `DraftDatasetAction`.
- `reducers/draftDatasetReducer.ts` — pure, immutable reducer.
- `selectors/draftDatasetSelectors.ts` — read helpers over the state.
- `hooks/useDraftDataset.ts` — `useReducer` wrapper with bound actions + selectors.
- `fixtures/draftDatasetFixtures.ts` — deterministic sample dataset.

## State

​
interface DraftDatasetState {
drafts: Draft[]; // working collection, insertion order
selectedId: string | null;
}

## Actions

| Action         | Effect                                                       |
| -------------- | ------------------------------------------------------------ |
| `loadDataset`  | Replace the dataset; clears selection.                       |
| `addDraft`     | Append a draft (ignores duplicate ids).                      |
| `updateDraft`  | Merge changes into a draft by id (id stays immutable).       |
| `removeDraft`  | Remove a draft by id; clears selection if it was selected.   |
| `selectDraft`  | Select an existing draft id, or `null`. Unknown ids ignored. |
| `clearDataset` | Reset to the empty initial state.                            |

## Selectors

`selectAllDrafts`, `selectDraftCount`, `selectIsEmpty`, `selectDraftById`,
`selectSelectedDraft`, and `selectFilteredDrafts` (reuses `DraftFilters` and
`helpers/datasetFilters`).

## Hook

​
const store = useDraftDataset(draftDatasetSample);
store.addDraft({ id: "draft-x", subject: "Hi", body: "…", recipients: ["a@example.com"] });
store.updateDraft("draft-x", { subject: "Edited" });
const matches = store.getFilteredDrafts({ searchQuery: "edited" });

## Follow-up integration (out of scope here)

Wiring this store into the dashboard shell, or feeding the curated `Draft[]` into
the live demo inbox, is a deliberate follow-up so this issue stays inside the
feature folder and changes no files outside it.
