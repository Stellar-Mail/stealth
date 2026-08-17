import { describe, expect, it } from "vitest";
import { draftDatasetReducer, initialDraftDatasetState } from "../reducers/draftDatasetReducer";
import type { Draft } from "../types/draft";
import type { DraftDatasetAction } from "../types/draftDataset";

const draftA: Draft = {
  id: "draft-a",
  subject: "Alpha subject",
  body: "Alpha body",
  recipients: ["ada@example.com"],
};
const draftB: Draft = {
  id: "draft-b",
  subject: "Beta subject",
  body: "Beta body",
  recipients: ["grace@example.org"],
};

describe("draftDatasetReducer", () => {
  it("loads a dataset and clears selection", () => {
    const action: DraftDatasetAction = {
      type: "loadDataset",
      payload: [draftA, draftB],
    };
    const state = draftDatasetReducer(initialDraftDatasetState, action);
    expect(state.drafts).toHaveLength(2);
    expect(state.selectedId).toBeNull();
  });

  it("adds a draft and ignores duplicate ids", () => {
    const loaded = draftDatasetReducer(initialDraftDatasetState, {
      type: "loadDataset",
      payload: [draftA],
    });
    const added = draftDatasetReducer(loaded, {
      type: "addDraft",
      payload: draftB,
    });
    expect(added.drafts).toHaveLength(2);

    const duplicate = draftDatasetReducer(added, {
      type: "addDraft",
      payload: draftB,
    });
    expect(duplicate).toBe(added);
  });

  it("updates a draft without changing its id", () => {
    const loaded = draftDatasetReducer(initialDraftDatasetState, {
      type: "loadDataset",
      payload: [draftA, draftB],
    });
    const updated = draftDatasetReducer(loaded, {
      type: "updateDraft",
      payload: { id: draftA.id, changes: { subject: "Edited subject" } },
    });
    const result = updated.drafts.find((draft) => draft.id === draftA.id);
    expect(result?.subject).toBe("Edited subject");
    expect(result?.body).toBe(draftA.body);
  });

  it("removes a draft and clears selection when it was selected", () => {
    const loaded = draftDatasetReducer(initialDraftDatasetState, {
      type: "loadDataset",
      payload: [draftA, draftB],
    });
    const selected = draftDatasetReducer(loaded, {
      type: "selectDraft",
      payload: { id: draftA.id },
    });
    const removed = draftDatasetReducer(selected, {
      type: "removeDraft",
      payload: { id: draftA.id },
    });
    expect(removed.drafts.some((draft) => draft.id === draftA.id)).toBe(false);
    expect(removed.selectedId).toBeNull();
  });

  it("only selects ids present in the dataset", () => {
    const loaded = draftDatasetReducer(initialDraftDatasetState, {
      type: "loadDataset",
      payload: [draftA, draftB],
    });
    const valid = draftDatasetReducer(loaded, {
      type: "selectDraft",
      payload: { id: draftB.id },
    });
    expect(valid.selectedId).toBe(draftB.id);

    const invalid = draftDatasetReducer(valid, {
      type: "selectDraft",
      payload: { id: "missing" },
    });
    expect(invalid).toBe(valid);
  });

  it("clears the dataset", () => {
    const loaded = draftDatasetReducer(initialDraftDatasetState, {
      type: "loadDataset",
      payload: [draftA, draftB],
    });
    const cleared = draftDatasetReducer(loaded, { type: "clearDataset" });
    expect(cleared.drafts).toHaveLength(0);
    expect(cleared.selectedId).toBeNull();
  });
});
