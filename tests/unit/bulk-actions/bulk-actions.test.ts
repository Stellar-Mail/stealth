import { describe, expect, it } from "vitest";
import { type Email, type MailFolder } from "@/components/mail/data";
import {
  buildBulkActionPatch,
  canApplyBulkActionToEmail,
  getBulkActionConfirmation,
  getBulkActionIdsForContext,
  isProtocolFolder,
  MOVE_FOLDERS,
  type BulkActionRequest,
} from "@/components/mail/bulk-actions";

const baseEmail: Email = {
  id: "bulk-1",
  from: "Request Sender",
  email: "sender*example",
  subject: "Request",
  preview: "Preview",
  body: "Body",
  time: "Now",
  unread: true,
  starred: false,
  folder: "requests",
  labels: ["Request"],
  avatarColor: "#5b6470",
};

function email(folder: MailFolder, overrides: Partial<Email> = {}): Email {
  return { ...baseEmail, id: `bulk-${folder}`, folder: folder as any, ...overrides };
}

describe("bulk action availability", () => {
  it("exposes only valid protocol-folder operations", () => {
    const protocolFolders: MailFolder[] = ["verified", "pending", "requests", "encrypted"];

    for (const folder of protocolFolders) {
      expect(isProtocolFolder(folder)).toBe(true);
      const actions = getBulkActionIdsForContext([email(folder)], folder);

      expect(actions).toContain("star");
      expect(actions).toContain("mark-read");
      expect(actions).toContain("block");
      expect(actions).not.toContain("archive");
      expect(actions).not.toContain("snooze");
      expect(actions).not.toContain("move");
      expect(MOVE_FOLDERS.some((folder) => isProtocolFolder(folder))).toBe(false);
    }

    expect(getBulkActionIdsForContext([email("requests")], "requests")).toContain("approve");
    expect(getBulkActionIdsForContext([email("verified")], "verified")).not.toContain("approve");
  });

  it("keeps non-protocol folders able to archive, snooze, star, mark read, and move", () => {
    const inboxEmail = email("inbox");
    const actions = getBulkActionIdsForContext([inboxEmail], "inbox");

    expect(actions).toEqual(
      expect.arrayContaining(["archive", "star", "snooze", "mark-read", "block", "move"]),
    );
    expect(actions).not.toContain("approve");
  });

  it("reports per-message applicability for mixed selections", () => {
    const archived = email("archive");
    const inbox = email("inbox");

    expect(canApplyBulkActionToEmail({ action: "archive" }, archived)).toBe(false);
    expect(canApplyBulkActionToEmail({ action: "archive" }, inbox)).toBe(true);
    expect(canApplyBulkActionToEmail({ action: "approve" }, archived)).toBe(false);
    expect(canApplyBulkActionToEmail({ action: "approve" }, email("requests"))).toBe(true);
  });
});

describe("bulk action patches and confirmations", () => {
  it("builds safe patches for archive, star, mark read, approve, block, move, and snooze", () => {
    const request = email("requests");
    const inbox = email("inbox");

    expect(buildBulkActionPatch({ action: "archive" }, inbox)).toMatchObject({
      ok: true,
      patch: { folder: "archive" },
    });
    expect(buildBulkActionPatch({ action: "star", value: true }, request)).toMatchObject({
      ok: true,
      patch: { starred: true },
    });
    expect(buildBulkActionPatch({ action: "mark-read" }, request)).toMatchObject({
      ok: true,
      patch: { unread: false },
    });
    expect(buildBulkActionPatch({ action: "approve" }, request)).toMatchObject({
      ok: true,
      patch: { folder: "inbox", senderPolicy: "allow" },
    });
    expect(buildBulkActionPatch({ action: "block" }, request)).toMatchObject({
      ok: true,
      patch: { folder: "spam", senderPolicy: "block" },
    });
    expect(buildBulkActionPatch({ action: "move", folder: "spam" }, inbox)).toMatchObject({
      ok: true,
      patch: { folder: "spam" },
    });
    expect(
      buildBulkActionPatch({ action: "snooze", snoozeChoice: "tomorrow" }, inbox),
    ).toMatchObject({
      ok: true,
      patch: { folder: "snoozed" },
    });
  });

  it("requires confirmation for destructive or protocol-affecting bulk changes", () => {
    const requests = [email("requests"), { ...email("requests"), id: "bulk-2" }];

    expect(getBulkActionConfirmation({ action: "archive" }, requests)?.confirmLabel).toBe(
      "Archive",
    );
    expect(getBulkActionConfirmation({ action: "block" }, requests)?.confirmLabel).toBe(
      "Block senders",
    );
    expect(getBulkActionConfirmation({ action: "approve" }, requests)?.confirmLabel).toBe(
      "Approve senders",
    );
    expect(
      getBulkActionConfirmation({ action: "move", folder: "trash" }, requests)?.confirmLabel,
    ).toBe("Move");
    expect(getBulkActionConfirmation({ action: "star", value: true }, requests)).toBeNull();
    expect(getBulkActionConfirmation({ action: "mark-read" }, requests)).toBeNull();
  });

  it("rejects invalid actions with reasons", () => {
    const archived: Email = { ...baseEmail, folder: "archive" };
    const blocked: Email = { ...baseEmail, folder: "requests", senderPolicy: "block" };
    const requests: BulkActionRequest[] = [
      { action: "archive" },
      { action: "approve" },
      { action: "block" },
    ];

    expect(buildBulkActionPatch(requests[0], archived)).toMatchObject({
      ok: false,
      reason: "Already archived.",
    });
    expect(buildBulkActionPatch(requests[1], blocked)).toMatchObject({
      ok: false,
      reason: "Sender is already blocked.",
    });
    expect(buildBulkActionPatch(requests[2], blocked)).toMatchObject({
      ok: false,
      reason: "Sender is already blocked.",
    });
  });
});
