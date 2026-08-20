import { describe, expect, it } from "vitest";

import { mailboxDescriptorToEmail, mailboxQueueToEmails } from "../../../src/features/mail";
import type { MailboxDescriptor } from "../../../src/lib/api";

const SENDER = `G${"B".repeat(55)}`;

function descriptor(overrides: Partial<MailboxDescriptor> = {}): MailboxDescriptor {
  return {
    messageId: "a".repeat(64),
    senderId: SENDER,
    recipientId: `G${"A".repeat(55)}`,
    status: "pending",
    createdAt: "2026-08-17T10:00:00Z",
    protectedHeaders: { alg: "dir", enc: "A256GCM", version: "v1" },
    isTombstone: false,
    deletedAt: null,
    ...overrides,
  };
}

describe("mailboxDescriptorToEmail (BETA-051)", () => {
  it("maps a pending descriptor to the pending folder as unread", () => {
    const email = mailboxDescriptorToEmail(descriptor());
    expect(email.id).toBe("a".repeat(64));
    expect(email.email).toBe(SENDER);
    expect(email.folder).toBe("pending");
    expect(email.unread).toBe(true);
    expect(email.subject).toBe("Encrypted message");
    expect(email.threadId).toContain("thread:");
  });

  it("maps server starred, unread, and folder flags when present", () => {
    const email = mailboxDescriptorToEmail(
      descriptor({
        status: "delivered",
        starred: true,
        unread: true,
        folder: "archive",
      }),
    );
    expect(email.folder).toBe("archive");
    expect(email.starred).toBe(true);
    expect(email.unread).toBe(true);
  });

  it("maps a tombstone to trash with a deleted label", () => {
    const email = mailboxDescriptorToEmail(
      descriptor({ isTombstone: true, deletedAt: "2026-08-17T12:00:00Z" }),
    );
    expect(email.folder).toBe("trash");
    expect(email.labels).toContain("Deleted");
  });

  it("reads the subject from protectedHeaders when present", () => {
    const email = mailboxDescriptorToEmail(
      descriptor({ protectedHeaders: { subject: "Quarterly report", alg: "dir" } }),
    );
    expect(email.subject).toBe("Quarterly report");
    expect(email.threadId).toContain("quarterly report");
  });

  it("maps an entire queue page to the display email list", () => {
    const emails = mailboxQueueToEmails({
      items: [descriptor(), descriptor({ messageId: "b".repeat(64), status: "delivered" })],
      nextCursor: null,
      hasMore: false,
    });
    expect(emails).toHaveLength(2);
    expect(emails[1].folder).toBe("inbox");
  });
});
