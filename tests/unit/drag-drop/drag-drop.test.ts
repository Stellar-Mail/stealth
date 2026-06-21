import { describe, expect, it } from "vitest";
import {
  canDragEmail,
  getDropRejectionReason,
  DROP_TARGET_FOLDERS,
} from "@/components/mail/useDragDrop";
import type { Email, MailLocation } from "@/components/mail/data";

function makeEmail(folder: MailLocation, overrides: Partial<Email> = {}): Email {
  return {
    id: "test-1",
    from: "Test Sender",
    email: "sender*example",
    subject: "Subject",
    preview: "Preview",
    body: "Body",
    time: "Now",
    unread: false,
    starred: false,
    folder,
    avatarColor: "#5b6470",
    ...overrides,
  };
}

describe("canDragEmail", () => {
  it("allows dragging inbox emails", () => {
    expect(canDragEmail(makeEmail("inbox"))).toBe(true);
  });

  it("allows dragging archive emails", () => {
    expect(canDragEmail(makeEmail("archive"))).toBe(true);
  });

  it("prevents dragging protocol folder emails", () => {
    const protocolFolders: MailLocation[] = ["verified", "pending", "requests", "encrypted"];
    for (const folder of protocolFolders) {
      expect(canDragEmail(makeEmail(folder))).toBe(false);
    }
  });

  it("prevents dragging sent/drafts/outbox/scheduled/trash emails", () => {
    const nonMovable: MailLocation[] = ["sent", "drafts", "outbox", "scheduled", "trash"];
    for (const folder of nonMovable) {
      expect(canDragEmail(makeEmail(folder))).toBe(false);
    }
  });
});

describe("getDropRejectionReason", () => {
  it("returns null when drop is valid", () => {
    const email = makeEmail("inbox");
    expect(getDropRejectionReason(email, "archive")).toBeNull();
  });

  it("rejects moving to same folder", () => {
    const email = makeEmail("inbox");
    expect(getDropRejectionReason(email, "inbox")).toBeTruthy();
  });

  it("rejects protocol folder emails with explanation", () => {
    const email = makeEmail("requests");
    const reason = getDropRejectionReason(email, "inbox");
    expect(reason).toBeTruthy();
    expect(reason).toMatch(/protocol/i);
  });

  it("rejects dropping to protocol folders", () => {
    const email = makeEmail("inbox");
    const reason = getDropRejectionReason(email, "verified");
    expect(reason).toBeTruthy();
  });
});

describe("DROP_TARGET_FOLDERS", () => {
  it("includes ordinary folders", () => {
    expect(DROP_TARGET_FOLDERS).toContain("inbox");
    expect(DROP_TARGET_FOLDERS).toContain("archive");
    expect(DROP_TARGET_FOLDERS).toContain("spam");
    expect(DROP_TARGET_FOLDERS).toContain("trash");
  });

  it("does not include protocol folders", () => {
    expect(DROP_TARGET_FOLDERS).not.toContain("verified");
    expect(DROP_TARGET_FOLDERS).not.toContain("pending");
    expect(DROP_TARGET_FOLDERS).not.toContain("requests");
    expect(DROP_TARGET_FOLDERS).not.toContain("encrypted");
  });
});
