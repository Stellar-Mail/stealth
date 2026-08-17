import { describe, expect, it } from "vitest";
import {
  selectAllDrafts,
  selectDraftById,
  selectDraftCount,
  selectFilteredDrafts,
  selectIsEmpty,
  selectSelectedDraft,
} from "../selectors/draftDatasetSelectors";
import { initialDraftDatasetState } from "../reducers/draftDatasetReducer";
import { draftDatasetSample } from "../fixtures/draftDatasetFixtures";
import type { Draft } from "../types/draft";
import type { DraftDatasetState } from "../types/draftDataset";

const drafts: Draft[] = draftDatasetSample;
const selected = drafts.find((draft) => draft.subject.includes("Postage"));

const state: DraftDatasetState = {
  drafts,
  selectedId: selected ? selected.id : null,
};

describe("draftDatasetSelectors", () => {
  it("selects all drafts and counts them", () => {
    expect(selectAllDrafts(state)).toHaveLength(drafts.length);
    expect(selectDraftCount(state)).toBe(drafts.length);
  });

  it("reports emptiness", () => {
    expect(selectIsEmpty(initialDraftDatasetState)).toBe(true);
    expect(selectIsEmpty(state)).toBe(false);
  });

  it("finds a draft by id", () => {
    const target = drafts.find((draft) => draft.subject.includes("Welcome"));
    expect(target).toBeDefined();
    expect(selectDraftById(state, target!.id)).toEqual(target);
    expect(selectDraftById(state, "missing")).toBeUndefined();
  });

  it("resolves the selected draft", () => {
    expect(selectSelectedDraft(state)?.id).toBe(selected?.id);
    expect(selectSelectedDraft(initialDraftDatasetState)).toBeNull();
  });

  it("filters drafts by subject using DraftFilters", () => {
    const filtered = selectFilteredDrafts(state, { subject: "Relay diagnostics" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.subject).toContain("Relay diagnostics");
  });
});
