import { describe, expect, it } from "vitest";
import type { OutboxEntry } from "@/services/storage/outbox";
import { outboxEntryToEmail } from "@/features/mail/useMailSource";
import { mergeLiveFolderCounts } from "@/features/mail/live-mailbox";
import type { MailboxCounts } from "@/lib/api";
import type { MailFolder } from "@/components/mail/data";

describe("outbox projection and mapping tests", () => {
  it("correctly maps a delivered outbox entry to sent folder", () => {
    const entry: OutboxEntry = {
      id: "msg-1234",
      createdAt: "2026-08-20T12:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z",
      subject: "Test Sent Message",
      recipients: ["alice@stealth.xyz"],
      status: "delivered",
      attempts: 1,
      postageAmount: "0.0001",
    };

    const email = outboxEntryToEmail(entry);

    expect(email.id).toBe("msg-1234");
    expect(email.folder).toBe("sent");
    expect(email.subject).toBe("Test Sent Message");
    expect(email.preview).toBe("Outbox: Message ready for delivery");
    expect(email.labels).toEqual([]);
    expect(email.postageAmount).toBe("0.0001");
  });

  it("correctly maps a pending outbox entry to outbox folder", () => {
    const entry: OutboxEntry = {
      id: "msg-5678",
      createdAt: "2026-08-20T12:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z",
      subject: "Test Pending Message",
      recipients: ["bob@stealth.xyz"],
      status: "queued",
      attempts: 0,
      postageAmount: "0.0002",
    };

    const email = outboxEntryToEmail(entry);

    expect(email.id).toBe("msg-5678");
    expect(email.folder).toBe("outbox");
    expect(email.subject).toBe("Test Pending Message");
    expect(email.preview).toBe("Outbox: Queued for delivery");
    expect(email.labels).toContain("Pending Outbox");
  });

  it("correctly maps a failed retryable outbox entry", () => {
    const entry: OutboxEntry = {
      id: "msg-9999",
      createdAt: "2026-08-20T12:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z",
      subject: "Test Failed Message",
      recipients: ["charlic@stealth.xyz"],
      status: "failed",
      attempts: 3,
      errorMessage: "Relay unreachable",
      canRetry: true,
    };

    const email = outboxEntryToEmail(entry);

    expect(email.id).toBe("msg-9999");
    expect(email.folder).toBe("outbox");
    expect(email.preview).toBe("Failed: Relay unreachable");
    expect(email.labels).toContain("Retryable Failure");
  });

  it("correctly maps a failed terminal outbox entry", () => {
    const entry: OutboxEntry = {
      id: "msg-0000",
      createdAt: "2026-08-20T12:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z",
      subject: "Test Terminal Failed Message",
      recipients: ["dan@stealth.xyz"],
      status: "failed",
      attempts: 3,
      errorMessage: "Recipient rejected postage",
      canRetry: false,
    };

    const email = outboxEntryToEmail(entry);

    expect(email.id).toBe("msg-0000");
    expect(email.folder).toBe("outbox");
    expect(email.labels).toContain("Terminal Failure");
  });

  it("preserves local counts for sent and outbox folders in mergeLiveFolderCounts", () => {
    const local: Record<MailFolder, number> = {
      all: 10,
      inbox: 5,
      priority: 2,
      snoozed: 0,
      verified: 3,
      pending: 0,
      requests: 0,
      encrypted: 0,
      receipts: 0,
      starred: 1,
      sent: 4, // local count (optimistic outbox entries included)
      outbox: 2, // local count (pending outbox entries included)
      drafts: 1,
      scheduled: 0,
      archive: 0,
      spam: 0,
      trash: 0,
    };

    const live: MailboxCounts = {
      inbox: 6,
      requests: 1,
      sent: 2, // live counts on server
      drafts: 2,
      outbox: 0, // live counts on server
      archive: 1,
      spam: 0,
      trash: 0,
      unread: 3,
      starred: 2,
    };

    const merged = mergeLiveFolderCounts(local, live);

    // inbox, drafts etc should use live counts
    expect(merged.inbox).toBe(6);
    expect(merged.drafts).toBe(2);
    // sent and outbox should preserve local counts
    expect(merged.sent).toBe(4);
    expect(merged.outbox).toBe(2);
  });
});
