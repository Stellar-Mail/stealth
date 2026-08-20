import { describe, expect, it } from "vitest";

import type { Email } from "@/components/mail/data";
import {
  buildFolderCounts,
  firstCustomFolderMatch,
  nextSelectedId,
  visibleEmailsFor,
} from "@/features/mail/navigation";
import { quoteBody } from "@/features/mail/useMailActions";

function email(id: string, folder: Email["folder"], labels: string[] = []): Email {
  return {
    id,
    from: "Ada",
    email: `${id}*stealth.mail`,
    subject: id,
    preview: "preview",
    body: "Hello\nWorld",
    time: "Tue",
    unread: false,
    starred: false,
    folder,
    labels,
    attachments: [],
    avatarColor: "#5b6470",
  };
}

describe("mail navigation helpers (BETA-053)", () => {
  const rows = [email("in-1", "inbox"), email("in-2", "inbox", ["Later"]), email("sent-1", "sent")];

  it("counts folders from the merged workspace, not from route-local copies", () => {
    const counts = buildFolderCounts(rows);
    expect(counts.inbox).toBe(2);
    expect(counts.sent).toBe(1);
    expect(counts.trash).toBe(0);
  });

  it("keeps the current selection when it is still visible", () => {
    expect(nextSelectedId(rows, "in-2")).toBe("in-2");
  });

  it("falls back to the first visible row when the current thread left the folder", () => {
    expect(nextSelectedId(visibleEmailsFor(rows, "sent", null), "in-1")).toBe("sent-1");
  });

  it("selects the first match in a custom folder", () => {
    expect(firstCustomFolderMatch(rows, "later")).toBe("in-2");
  });
});

describe("quoteBody", () => {
  it("quotes the original message for reply/forward compose drafts", () => {
    const quoted = quoteBody(email("in-1", "inbox"));
    expect(quoted).toContain("Ada <in-1*stealth.mail>");
    expect(quoted).toContain("> Hello");
    expect(quoted).toContain("> World");
  });
});
