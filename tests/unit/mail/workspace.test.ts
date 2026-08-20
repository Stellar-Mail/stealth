import { describe, expect, it } from "vitest";

import type { Email } from "@/components/mail/data";
import {
  applyEmailPatch,
  insertWorkspaceEmail,
  mergeMailWorkspace,
  revertEmailPatch,
  type MailWorkspaceOverlay,
} from "@/features/mail/workspace";

function email(id: string, folder: Email["folder"] = "inbox"): Email {
  return {
    id,
    from: "Ada",
    email: `${id}*stealth.mail`,
    subject: id,
    preview: "preview",
    body: "body",
    time: "Now",
    unread: false,
    starred: false,
    folder,
    labels: [],
    attachments: [],
    avatarColor: "#5b6470",
  };
}

describe("mergeMailWorkspace (BETA-053)", () => {
  it("keeps local patches when the live queue grows", () => {
    const overlay: MailWorkspaceOverlay = {
      patches: { a: { starred: true, unread: false } },
      inserts: [],
    };

    const merged = mergeMailWorkspace([email("a"), email("b"), email("c")], overlay);

    expect(merged.find((item) => item.id === "a")?.starred).toBe(true);
    expect(merged.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps locally inserted sent mail that the server has not echoed yet", () => {
    const overlay = insertWorkspaceEmail({ patches: {}, inserts: [] }, email("local-1", "sent"));

    const merged = mergeMailWorkspace([email("a")], overlay);
    expect(merged.map((item) => item.id)).toEqual(["local-1", "a"]);
  });

  it("lets the live row win the base record, then applies the overlay patch", () => {
    const overlay = applyEmailPatch(
      insertWorkspaceEmail({ patches: {}, inserts: [] }, email("a", "inbox")),
      "a",
      { folder: "archive" },
    );

    const merged = mergeMailWorkspace([email("a", "inbox")], overlay);
    const row = merged.find((item) => item.id === "a");
    expect(row?.folder).toBe("archive");
    expect(row?.from).toBe("Ada");
  });

  it("reverts a failed live mutation without dropping other patches", () => {
    let overlay = applyEmailPatch({ patches: {}, inserts: [] }, "a", {
      starred: true,
      folder: "trash",
    });
    overlay = revertEmailPatch(overlay, "a", { folder: "inbox" });

    const merged = mergeMailWorkspace([email("a")], overlay);
    expect(merged[0]?.starred).toBe(true);
    expect(merged[0]?.folder).toBe("inbox");
  });
});
