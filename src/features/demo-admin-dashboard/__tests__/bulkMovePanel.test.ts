import { describe, expect, it } from "vitest";
import {
  applyBulkFolderMove,
  getMessageFolderLabel,
  isValidMessageFolder,
  previewBulkFolderMove,
  summarizeBulkFolderMove,
  validateBulkFolderMove,
} from "../bulkMovePanel";
import type { EditableMessage } from "../constants/messageListEditorModel";

function makeMessage(id: string, folder: EditableMessage["folder"]): EditableMessage {
  return {
    id,
    subject: `Subject ${id}`,
    sender: `sender-${id}@example.com`,
    preview: `Preview ${id}`,
    folder,
    unread: false,
    starred: false,
  };
}

function sampleMessages(): EditableMessage[] {
  return [makeMessage("m1", "inbox"), makeMessage("m2", "drafts"), makeMessage("m3", "archive")];
}

describe("isValidMessageFolder", () => {
  it("accepts known folders and rejects unknown values", () => {
    expect(isValidMessageFolder("inbox")).toBe(true);
    expect(isValidMessageFolder("drafts")).toBe(true);
    expect(isValidMessageFolder("snoozed")).toBe(false);
    expect(isValidMessageFolder("pending")).toBe(false);
  });
});

describe("validateBulkFolderMove", () => {
  it("rejects empty selection", () => {
    const result = validateBulkFolderMove(sampleMessages(), [], "drafts");
    expect(result).toEqual({ ok: false, error: "Select at least one message to move." });
  });

  it("rejects invalid target folders", () => {
    const result = validateBulkFolderMove(sampleMessages(), ["m1"], "snoozed");
    expect(result).toEqual({ ok: false, error: "Choose a valid destination folder." });
  });

  it("rejects unknown message ids", () => {
    const result = validateBulkFolderMove(sampleMessages(), ["m1", "missing"], "drafts");
    expect(result).toEqual({ ok: false, error: "Unknown message id(s): missing" });
  });

  it("accepts valid input", () => {
    expect(validateBulkFolderMove(sampleMessages(), ["m1", "m2"], "drafts")).toEqual({ ok: true });
  });
});

describe("previewBulkFolderMove", () => {
  it("counts moves and skips for already-matched folders", () => {
    const preview = previewBulkFolderMove(sampleMessages(), ["m1", "m2", "m3"], "drafts");
    expect(preview).toEqual({
      targetFolder: "drafts",
      selectedCount: 3,
      movedCount: 2,
      skippedCount: 1,
    });
  });
});

describe("applyBulkFolderMove", () => {
  it("moves selected messages without mutating input", () => {
    const messages = sampleMessages();
    const result = applyBulkFolderMove(messages, ["m1", "m3"], "drafts");

    expect(messages[0].folder).toBe("inbox");
    expect(messages[2].folder).toBe("archive");
    expect(result.messages[0].folder).toBe("drafts");
    expect(result.messages[1].folder).toBe("drafts");
    expect(result.messages[2].folder).toBe("drafts");
  });

  it("skips messages already in the target folder", () => {
    const result = applyBulkFolderMove(sampleMessages(), ["m2"], "drafts");

    expect(result.changes[0]).toMatchObject({
      id: "m2",
      applied: false,
      skippedReason: "already in target folder",
    });
    expect(result.summary.movedCount).toBe(0);
    expect(result.summary.skippedCount).toBe(1);
  });
});

describe("summarizeBulkFolderMove", () => {
  it("summarizes successful moves", () => {
    const result = applyBulkFolderMove(sampleMessages(), ["m1", "m3"], "drafts");
    expect(summarizeBulkFolderMove(result)).toBe(
      `Moved 2 messages to ${getMessageFolderLabel("drafts")}.`,
    );
  });

  it("reports when nothing changed", () => {
    const result = applyBulkFolderMove(sampleMessages(), ["m2"], "drafts");
    expect(summarizeBulkFolderMove(result)).toBe(
      `No changes — all already in the target folder (1 skipped).`,
    );
  });

  it("reports partial skips", () => {
    const result = applyBulkFolderMove(sampleMessages(), ["m1", "m2"], "drafts");
    expect(summarizeBulkFolderMove(result)).toBe(
      `Moved 1 message to ${getMessageFolderLabel(
        "drafts",
      )} (1 skipped — already in ${getMessageFolderLabel("drafts")}).`,
    );
  });
});
