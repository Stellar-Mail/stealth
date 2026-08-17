import { describe, expect, it } from "vitest";
import {
  DEFAULT_MESSAGE_FOLDER,
  MESSAGE_FIELDS,
  MESSAGE_FOLDERS,
  createEmptyMessage,
  getMessageField,
} from "../constants/messageListEditorModel";
import { messageListFixtures } from "../fixtures/messageListFixtures";

describe("message list editor model", () => {
  it("exposes metadata for each editable field", () => {
    const keys = MESSAGE_FIELDS.map((field) => field.key);
    expect(keys).toEqual(["subject", "sender", "preview", "folder", "unread", "starred"]);
    for (const field of MESSAGE_FIELDS) {
      expect(field.label.length).toBeGreaterThan(0);
      expect(field.helpText.length).toBeGreaterThan(0);
    }
  });

  it("creates an empty message with a valid default folder", () => {
    const message = createEmptyMessage("msg-1");
    expect(message.id).toBe("msg-1");
    expect(message.subject).toBe("");
    expect(message.folder).toBe(DEFAULT_MESSAGE_FOLDER);
    expect(MESSAGE_FOLDERS).toContain(message.folder);
  });

  it("looks up a field by key and files fixtures in known folders", () => {
    expect(getMessageField("subject").type).toBe("text");
    for (const message of messageListFixtures) {
      expect(MESSAGE_FOLDERS).toContain(message.folder);
    }
  });
});
