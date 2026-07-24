import { describe, expect, it } from "vitest";
import type { DraftDatasetState } from "../types/draftDataset";
import {
  adminEditHistoryReducer,
  canRedoAdminEdit,
  canUndoAdminEdit,
  createAdminEditHistory,
  summarizeAdminEditHistory,
} from "../reducers/historyReducer";

const emptyDataset: DraftDatasetState = {
  drafts: [],
  selectedId: null,
};

const oneDraftDataset: DraftDatasetState = {
  drafts: [
    {
      id: "draft-alpha",
      subject: "Alpha",
      body: "Safe fake message body.",
      recipients: ["alpha@example.com"],
    },
  ],
  selectedId: "draft-alpha",
};

const twoDraftDataset: DraftDatasetState = {
  drafts: [
    ...oneDraftDataset.drafts,
    {
      id: "draft-beta",
      subject: "Beta",
      body: "Another deterministic fake message.",
      recipients: ["beta@example.org"],
    },
  ],
  selectedId: "draft-beta",
};

describe("adminEditHistoryReducer", () => {
  it("creates bounded edit history state", () => {
    const history = createAdminEditHistory(emptyDataset, 3);

    expect(history).toEqual({
      past: [],
      present: emptyDataset,
      future: [],
      limit: 3,
    });
    expect(canUndoAdminEdit(history)).toBe(false);
    expect(canRedoAdminEdit(history)).toBe(false);
  });

  it("pushes a new present value and clears redo history", () => {
    const withOneDraft = adminEditHistoryReducer(createAdminEditHistory(emptyDataset), {
      type: "push",
      payload: oneDraftDataset,
    });
    const undone = adminEditHistoryReducer(withOneDraft, { type: "undo" });
    const replaced = adminEditHistoryReducer(undone, {
      type: "push",
      payload: twoDraftDataset,
    });

    expect(replaced.past).toEqual([emptyDataset]);
    expect(replaced.present).toBe(twoDraftDataset);
    expect(replaced.future).toEqual([]);
  });

  it("does not create a new history entry for the same object reference", () => {
    const initial = createAdminEditHistory(emptyDataset);
    const unchanged = adminEditHistoryReducer(initial, {
      type: "push",
      payload: emptyDataset,
    });

    expect(unchanged).toBe(initial);
  });

  it("undoes and redoes edits in order", () => {
    const initial = createAdminEditHistory(emptyDataset);
    const first = adminEditHistoryReducer(initial, { type: "push", payload: oneDraftDataset });
    const second = adminEditHistoryReducer(first, { type: "push", payload: twoDraftDataset });

    const undone = adminEditHistoryReducer(second, { type: "undo" });
    expect(undone.present).toBe(oneDraftDataset);
    expect(undone.future).toEqual([twoDraftDataset]);

    const redone = adminEditHistoryReducer(undone, { type: "redo" });
    expect(redone.present).toBe(twoDraftDataset);
    expect(redone.past).toEqual([emptyDataset, oneDraftDataset]);
    expect(redone.future).toEqual([]);
  });

  it("keeps only the latest past states when the limit is reached", () => {
    let history = createAdminEditHistory(emptyDataset, 2);
    history = adminEditHistoryReducer(history, { type: "push", payload: oneDraftDataset });
    history = adminEditHistoryReducer(history, { type: "push", payload: twoDraftDataset });
    history = adminEditHistoryReducer(history, {
      type: "push",
      payload: { ...twoDraftDataset, selectedId: null },
    });

    expect(history.past).toEqual([oneDraftDataset, twoDraftDataset]);
    expect(history.limit).toBe(2);
  });

  it("resets history without changing the current limit", () => {
    const history = adminEditHistoryReducer(createAdminEditHistory(emptyDataset, 4), {
      type: "push",
      payload: oneDraftDataset,
    });
    const reset = adminEditHistoryReducer(history, { type: "reset", payload: twoDraftDataset });

    expect(reset).toEqual({
      past: [],
      present: twoDraftDataset,
      future: [],
      limit: 4,
    });
  });

  it("normalizes limit changes and trims existing past states", () => {
    let history = createAdminEditHistory(emptyDataset, 5);
    history = adminEditHistoryReducer(history, { type: "push", payload: oneDraftDataset });
    history = adminEditHistoryReducer(history, { type: "push", payload: twoDraftDataset });

    const limited = adminEditHistoryReducer(history, { type: "setLimit", payload: 1.8 });

    expect(limited.limit).toBe(1);
    expect(limited.past).toEqual([oneDraftDataset]);
  });

  it("summarizes undo and redo availability for toolbar consumers", () => {
    const pushed = adminEditHistoryReducer(createAdminEditHistory(emptyDataset), {
      type: "push",
      payload: oneDraftDataset,
    });
    const undone = adminEditHistoryReducer(pushed, { type: "undo" });

    expect(summarizeAdminEditHistory(undone)).toEqual({
      canUndo: false,
      canRedo: true,
      undoCount: 0,
      redoCount: 1,
      limit: 25,
    });
  });
});
