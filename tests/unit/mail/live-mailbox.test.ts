import { describe, expect, it } from "vitest";

import type { Email } from "@/components/mail/data";
import type { MailboxDescriptor } from "@/lib/api";
import {
  applyOverlayToCounts,
  capMailboxWindow,
  claimMailboxMutation,
  emptyMailboxCounts,
  mailboxMutationKey,
  mergeMailboxDescriptors,
} from "@/features/mail/live-mailbox";
import {
  applyMailboxFlags,
  countMailbox,
  envelopeToMailboxDescriptor,
  mailboxChangedSince,
} from "@/server/api/mailbox-live";
import type { StoredEnvelope } from "@/server/api/domain";

const SENDER = `G${"B".repeat(55)}`;
const RECIPIENT = `G${"A".repeat(55)}`;
const MSG = "a".repeat(64);

function envelope(overrides: Partial<StoredEnvelope> = {}): StoredEnvelope {
  return {
    messageId: MSG,
    senderId: SENDER,
    recipientId: RECIPIENT,
    ciphertext: "aGVsbG8=",
    protectedHeaders: { alg: "dir", enc: "A256GCM", version: "v1" },
    createdAt: "2026-08-17T10:00:00Z",
    status: "pending",
    ...overrides,
  };
}

function descriptor(id: string, overrides: Partial<MailboxDescriptor> = {}): MailboxDescriptor {
  return {
    messageId: id,
    senderId: SENDER,
    recipientId: RECIPIENT,
    status: "delivered",
    createdAt: "2026-08-17T10:00:00Z",
    protectedHeaders: {},
    isTombstone: false,
    deletedAt: null,
    starred: false,
    unread: false,
    folder: "inbox",
    ...overrides,
  };
}

function email(id: string, overrides: Partial<Email> = {}): Email {
  return {
    id,
    from: "Ada",
    email: `${id}*stealth.mail`,
    subject: id,
    preview: "preview",
    body: "body",
    time: "Now",
    unread: true,
    starred: false,
    folder: "inbox",
    labels: [],
    attachments: [],
    avatarColor: "#5b6470",
    ...overrides,
  };
}

describe("mailbox live helpers (BETA-054)", () => {
  it("counts an empty mailbox as zeros", () => {
    expect(countMailbox([])).toEqual(emptyMailboxCounts());
  });

  it("counts inbox, unread, starred, archive, trash, and deletion", () => {
    const pending = envelope({ messageId: "1".repeat(64), status: "pending" });
    const starred = applyMailboxFlags(
      envelope({
        messageId: "2".repeat(64),
        status: "delivered",
        createdAt: "2026-08-17T11:00:00Z",
      }),
      { starred: true, unread: false },
      "2026-08-17T11:01:00Z",
    );
    const archived = applyMailboxFlags(
      envelope({
        messageId: "3".repeat(64),
        status: "delivered",
        createdAt: "2026-08-17T12:00:00Z",
      }),
      { folder: "archive", unread: false },
      "2026-08-17T12:01:00Z",
    );
    const trashed = applyMailboxFlags(
      envelope({
        messageId: "4".repeat(64),
        status: "delivered",
        createdAt: "2026-08-17T13:00:00Z",
      }),
      { folder: "trash" },
      "2026-08-17T13:01:00Z",
    );

    const counts = countMailbox([pending, starred, archived, trashed]);
    expect(counts.inbox).toBe(2);
    expect(counts.unread).toBe(1);
    expect(counts.starred).toBe(1);
    expect(counts.archive).toBe(1);
    expect(counts.trash).toBe(1);
    expect(envelopeToMailboxDescriptor(starred).starred).toBe(true);
    expect(envelopeToMailboxDescriptor(archived).folder).toBe("archive");
    expect(envelopeToMailboxDescriptor(trashed).isTombstone).toBe(true);
  });

  it("treats flag updates as incremental changes after the sync cursor", () => {
    const updated = applyMailboxFlags(envelope(), { unread: false }, "2026-08-17T12:00:00Z");
    expect(mailboxChangedSince(updated, "2026-08-17T11:00:00Z")).toBe(true);
    expect(mailboxChangedSince(updated, "2026-08-17T12:00:00Z")).toBe(false);
  });

  it("merges cursor deltas, drops deletions, and caps the render window", () => {
    const existing = [
      descriptor("1".repeat(64), { createdAt: "2026-08-17T10:00:00Z" }),
      descriptor("2".repeat(64), { createdAt: "2026-08-17T11:00:00Z" }),
    ];
    const merged = mergeMailboxDescriptors(
      existing,
      [descriptor("3".repeat(64), { createdAt: "2026-08-17T12:00:00Z", unread: true })],
      ["1".repeat(64)],
    );
    expect(merged.map((item) => item.messageId)).toEqual(["3".repeat(64), "2".repeat(64)]);

    const large = Array.from({ length: 250 }, (_, index) =>
      descriptor(index.toString(16).padStart(64, "0"), {
        createdAt: `2026-08-17T10:${String(index % 60).padStart(2, "0")}:00Z`,
      }),
    );
    expect(capMailboxWindow(large, 200)).toHaveLength(200);
  });

  it("adjusts live counts for optimistic overlay patches and local inserts", () => {
    const server = [email("a")];
    const counts = applyOverlayToCounts(
      { ...emptyMailboxCounts(), inbox: 1, unread: 1 },
      {
        patches: { a: { unread: false, starred: true, folder: "archive" } },
        inserts: [email("local-sent", { folder: "sent", unread: false })],
      },
      server,
    );
    expect(counts.inbox).toBe(0);
    expect(counts.archive).toBe(1);
    expect(counts.unread).toBe(0);
    expect(counts.starred).toBe(1);
    expect(counts.sent).toBe(1);
  });

  it("claims an in-flight mutation once so retries do not duplicate it", () => {
    const pending = new Set<string>();
    const key = mailboxMutationKey("a", { starred: true });
    expect(claimMailboxMutation(pending, key)).toBe(true);
    expect(claimMailboxMutation(pending, key)).toBe(false);
  });
});
