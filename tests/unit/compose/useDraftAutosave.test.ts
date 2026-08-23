// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as draftApi from "@/features/compose/draftApi";
import { useDraftAutosave } from "@/features/compose/useDraftAutosave";
import type { Draft } from "@/server/api/domain";

describe("useDraftAutosave hook (BETA-058 / Issue #1965)", () => {
  const sampleDraft: Draft = {
    draftId: "d_auto_100",
    owner: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    to: ["alice@stealth.xyz"],
    cc: [],
    bcc: [],
    subject: "Test Subject",
    body: "Hello World",
    attachments: [],
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not create a draft when content is completely empty", async () => {
    const createSpy = vi.spyOn(draftApi, "createDraft");
    const { result } = renderHook(() =>
      useDraftAutosave({
        to: "",
        subject: "",
        body: "",
        attachments: [],
        debounceMs: 500,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(createSpy).not.toHaveBeenCalled();
    expect(result.current.draftId).toBeNull();
    expect(result.current.saveStatus).toBe("idle");
  });

  it("triggers debounced draft creation when user enters text", async () => {
    const createSpy = vi.spyOn(draftApi, "createDraft").mockResolvedValueOnce(sampleDraft);

    const { result, rerender } = renderHook(
      (props) =>
        useDraftAutosave({
          to: props.to,
          subject: props.subject,
          body: props.body,
          debounceMs: 500,
        }),
      {
        initialProps: { to: "", subject: "", body: "" },
      },
    );

    // User types subject and body
    rerender({ to: "alice@stealth.xyz", subject: "Test Subject", body: "Hello World" });

    expect(result.current.isDirty).toBe(true);

    // Fast-forward debounce timer
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith({
      to: ["alice@stealth.xyz"],
      cc: [],
      bcc: [],
      subject: "Test Subject",
      body: "Hello World",
      attachments: [],
    });

    expect(result.current.draftId).toBe("d_auto_100");
    expect(result.current.version).toBe(1);
    expect(result.current.saveStatus).toBe("saved");
    expect(result.current.lastSavedAt).not.toBeNull();
  });

  it("updates existing draft with expectedVersion when edited again", async () => {
    const updatedDraft: Draft = {
      ...sampleDraft,
      version: 2,
      body: "Updated Body Content",
      updatedAt: "2026-01-01T00:01:00.000Z",
    };
    const updateSpy = vi.spyOn(draftApi, "updateDraft").mockResolvedValueOnce(updatedDraft);

    const { result, rerender } = renderHook(
      (props) =>
        useDraftAutosave({
          initialDraftId: "d_auto_100",
          initialVersion: 1,
          to: props.to,
          subject: props.subject,
          body: props.body,
          debounceMs: 500,
        }),
      {
        initialProps: { to: "alice@stealth.xyz", subject: "Test", body: "Hello" },
      },
    );

    // User edits body
    rerender({ to: "alice@stealth.xyz", subject: "Test", body: "Updated Body Content" });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(
      "d_auto_100",
      expect.objectContaining({
        body: "Updated Body Content",
        expectedVersion: 1,
      }),
      1,
    );

    expect(result.current.version).toBe(2);
    expect(result.current.saveStatus).toBe("saved");
  });

  it("handles offline network failure gracefully and preserves local state", async () => {
    vi.spyOn(draftApi, "createDraft").mockRejectedValueOnce(new Error("Network offline"));

    const { result, rerender } = renderHook(
      (props) =>
        useDraftAutosave({
          to: props.to,
          subject: props.subject,
          body: props.body,
          debounceMs: 500,
        }),
      {
        initialProps: { to: "", subject: "", body: "" },
      },
    );

    rerender({ to: "alice@stealth.xyz", subject: "Offline Draft", body: "Important unsent text" });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.saveStatus).toBe("error");
    expect(result.current.errorMessage).toContain("Network offline");

    // Edits are preserved and user can flush when back online
    vi.spyOn(draftApi, "createDraft").mockResolvedValueOnce({
      ...sampleDraft,
      subject: "Offline Draft",
      body: "Important unsent text",
    });

    await act(async () => {
      await result.current.flushDraftSave();
    });

    expect(result.current.saveStatus).toBe("saved");
    expect(result.current.draftId).toBe("d_auto_100");
  });

  it("detects revision conflicts (409) and allows user-controlled recovery", async () => {
    const remoteDraft: Draft = {
      ...sampleDraft,
      version: 5,
      subject: "Remote Tab Edit",
      body: "Edited on tab 2",
    };

    const conflictError = new draftApi.DraftConflictError("Draft revision conflict", remoteDraft);

    vi.spyOn(draftApi, "updateDraft").mockRejectedValueOnce(conflictError);

    const onApplyMock = vi.fn();

    const { result, rerender } = renderHook(
      (props) =>
        useDraftAutosave({
          initialDraftId: "d_auto_100",
          initialVersion: 1,
          to: props.to,
          subject: props.subject,
          body: props.body,
          debounceMs: 500,
          onApplyServerDraft: onApplyMock,
        }),
      {
        initialProps: { to: "alice@stealth.xyz", subject: "Initial", body: "Initial" },
      },
    );

    // Local edit causes conflict
    rerender({ to: "alice@stealth.xyz", subject: "Initial", body: "My local edit" });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.saveStatus).toBe("conflict");
    expect(result.current.conflictDraft).toEqual(remoteDraft);

    // Resolution: Load Server Copy
    act(() => {
      result.current.resolveConflictLoadServer();
    });

    expect(onApplyMock).toHaveBeenCalledWith(remoteDraft);
    expect(result.current.version).toBe(5);
    expect(result.current.saveStatus).toBe("saved");
  });

  it("resolves conflict via overwrite by bumping expectedVersion to server version", async () => {
    const remoteDraft: Draft = {
      ...sampleDraft,
      version: 3,
      body: "Remote text",
    };

    const conflictError = new draftApi.DraftConflictError("Draft revision conflict", remoteDraft);

    vi.spyOn(draftApi, "updateDraft").mockRejectedValueOnce(conflictError);

    const { result, rerender } = renderHook(
      (props) =>
        useDraftAutosave({
          initialDraftId: "d_auto_100",
          initialVersion: 1,
          to: props.to,
          subject: props.subject,
          body: props.body,
          debounceMs: 500,
        }),
      {
        initialProps: { to: "alice@stealth.xyz", subject: "Title", body: "Local text" },
      },
    );

    // Local edit conflicts
    rerender({ to: "alice@stealth.xyz", subject: "Title", body: "My important override" });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.saveStatus).toBe("conflict");

    // User chooses Overwrite
    const overwriteSuccess: Draft = {
      ...sampleDraft,
      version: 4,
      body: "My important override",
      updatedAt: "2026-01-01T00:02:00.000Z",
    };
    vi.spyOn(draftApi, "updateDraft").mockResolvedValueOnce(overwriteSuccess);

    await act(async () => {
      await result.current.resolveConflictOverwrite();
    });

    expect(result.current.saveStatus).toBe("saved");
    expect(result.current.version).toBe(4);
  });

  it("cancels pending autosave and discards draft on discard/send", async () => {
    const deleteSpy = vi.spyOn(draftApi, "deleteDraft").mockResolvedValueOnce();

    const { result } = renderHook(() =>
      useDraftAutosave({
        initialDraftId: "d_to_delete",
        initialVersion: 2,
        to: "alice@stealth.xyz",
        subject: "Send Draft",
        body: "Ready to send",
      }),
    );

    await act(async () => {
      await result.current.discardDraft();
    });

    expect(deleteSpy).toHaveBeenCalledWith("d_to_delete");
    expect(result.current.draftId).toBeNull();
    expect(result.current.saveStatus).toBe("idle");
  });
});
