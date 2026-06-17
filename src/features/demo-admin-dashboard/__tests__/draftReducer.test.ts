import { describe, expect, it } from "vitest";
import { draftReducer, initialState } from "../reducers/draftReducer";
import { draftSample } from "../fixtures/draftFixtures";
import { DraftAction } from "../types/draft";

describe("draftReducer", () => {
  it("loads a draft", () => {
    const action: DraftAction = { type: "loadDraft", payload: draftSample };
    const newState = draftReducer(initialState, action);
    expect(newState.current).toEqual(draftSample);
  });

  it("edits a draft partially", () => {
    const loadAction: DraftAction = { type: "loadDraft", payload: draftSample };
    const stateAfterLoad = draftReducer(initialState, loadAction);
    const editAction: DraftAction = { type: "editDraft", payload: { subject: "Updated Subject" } };
    const editedState = draftReducer(stateAfterLoad, editAction);
    expect(editedState.current?.subject).toBe("Updated Subject");
    expect(editedState.current?.body).toBe(draftSample.body);
  });

  it("resets the draft", () => {
    const loadAction: DraftAction = { type: "loadDraft", payload: draftSample };
    const stateAfterLoad = draftReducer(initialState, loadAction);
    const resetAction: DraftAction = { type: "resetDraft" };
    const resetState = draftReducer(stateAfterLoad, resetAction);
    expect(resetState.current).toBeNull();
  });
});
