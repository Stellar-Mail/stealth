import { describe, expect, it } from "vitest";
import {
  inboxSeedDataset,
  inboxSeedMessages,
  inboxSeedSenders,
} from "../fixtures/inboxSeedDataset";
import {
  inboxSeedFolderCounts,
  inboxSeedFolderMap,
  inboxSeedMetadata,
} from "../fixtures/inboxSeedMetadata";
import {
  collectLabels,
  computeFolderDistribution,
  findMessageById,
  findSenderByAddress,
  getMessagesByFolder,
  getMessagesByLabel,
  getMessagesByProofStatus,
  getMessagesBySender,
  getMessagesWithAttachments,
  getMessagesWithCalendarEvent,
  getSnoozedMessages,
  getStarredMessages,
  getTrustedSenders,
  getUnreadMessages,
  getUntrustedSenders,
  getRelaySenders,
} from "../utils/inboxSeedHelpers";

// ---------------------------------------------------------------------------
// Safety: all addresses must use safe demo domains
// ---------------------------------------------------------------------------

const SAFE_DOMAIN_RE =
  /@(example\.com|example\.org|[\w-]+\.stealth\.demo|[\w-]+\.stealth\.network|[\w.-]+)$/;

describe("inboxSeedDataset — safety", () => {
  it("every sender address matches the safe-domain pattern", () => {
    for (const sender of inboxSeedSenders) {
      expect(sender.address).toMatch(SAFE_DOMAIN_RE);
    }
  });

  it("every recipient address matches the safe-domain pattern", () => {
    for (const msg of inboxSeedMessages) {
      for (const addr of msg.recipients) {
        expect(addr).toMatch(SAFE_DOMAIN_RE);
      }
    }
  });

  it("no message body contains a real-looking private key or secret", () => {
    const SECRET_PATTERNS = [
      /S[A-Z0-9]{55}/, // Stellar secret key
      /-----BEGIN.*PRIVATE KEY-----/,
      /sk_[a-zA-Z0-9]{20,}/,
    ];
    for (const msg of inboxSeedMessages) {
      for (const pattern of SECRET_PATTERNS) {
        expect(msg.body).not.toMatch(pattern);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("inboxSeedDataset — determinism", () => {
  it("message ids are stable across imports", () => {
    const ids = inboxSeedMessages.map((m) => m.id);
    expect(ids).toEqual([
      "seed-msg-01",
      "seed-msg-02",
      "seed-msg-03",
      "seed-msg-04",
      "seed-msg-05",
      "seed-msg-05b",
      "seed-msg-05c",
      "seed-msg-06",
      "seed-msg-06b",
      "seed-msg-06c",
      "seed-msg-06d",
      "seed-msg-07",
      "seed-msg-08",
      "seed-msg-09",
      "seed-msg-10",
      "seed-msg-11",
      "seed-msg-12",
      "seed-msg-13",
      "seed-msg-14",
      "seed-msg-15",
      "seed-msg-16",
    ]);
  });

  it("no duplicate message ids", () => {
    const ids = inboxSeedMessages.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no duplicate sender addresses", () => {
    const addrs = inboxSeedSenders.map((s) => s.address);
    expect(new Set(addrs).size).toBe(addrs.length);
  });

  it("all timestamps are deterministic ISO strings", () => {
    for (const msg of inboxSeedMessages) {
      expect(msg.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }
  });
});

// ---------------------------------------------------------------------------
// Completeness — mirrors the original 18-email inbox
// ---------------------------------------------------------------------------

describe("inboxSeedDataset — completeness", () => {
  it("contains exactly 21 messages (18 original + 3 extra request/encrypted variants)", () => {
    expect(inboxSeedMessages).toHaveLength(21);
  });

  it("dataset references all messages", () => {
    expect(inboxSeedDataset.messages).toBe(inboxSeedMessages);
  });

  it("dataset references all senders", () => {
    expect(inboxSeedDataset.senders).toBe(inboxSeedSenders);
  });

  it("every message sender is present in the senders list", () => {
    const senderAddresses = new Set(inboxSeedSenders.map((s) => s.address));
    for (const msg of inboxSeedMessages) {
      expect(senderAddresses.has(msg.sender.address)).toBe(true);
    }
  });

  it("folder map covers every message id", () => {
    for (const msg of inboxSeedMessages) {
      expect(inboxSeedFolderMap[msg.id]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Metadata accuracy
// ---------------------------------------------------------------------------

describe("inboxSeedMetadata", () => {
  it("totalMessages matches message array length", () => {
    expect(inboxSeedMetadata.totalMessages).toBe(inboxSeedMessages.length);
  });

  it("uniqueSenders matches sender array length", () => {
    expect(inboxSeedMetadata.uniqueSenders).toBe(inboxSeedSenders.length);
  });

  it("read + unread counts sum to total", () => {
    expect(inboxSeedMetadata.readCount + inboxSeedMetadata.unreadCount).toBe(
      inboxSeedMetadata.totalMessages,
    );
  });

  it("starred + unstarred counts sum to total", () => {
    expect(inboxSeedMetadata.starredCount + inboxSeedMetadata.unstarredCount).toBe(
      inboxSeedMetadata.totalMessages,
    );
  });

  it("folder counts sum to total messages", () => {
    const total = Object.values(inboxSeedFolderCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(inboxSeedMessages.length);
  });

  it("allLabels is sorted alphabetically", () => {
    const sorted = [...inboxSeedMetadata.allLabels].sort();
    expect(inboxSeedMetadata.allLabels).toEqual(sorted);
  });

  it("allSenderNames is sorted alphabetically", () => {
    const sorted = [...inboxSeedMetadata.allSenderNames].sort();
    expect(inboxSeedMetadata.allSenderNames).toEqual(sorted);
  });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe("inboxSeedHelpers", () => {
  describe("getMessagesByLabel", () => {
    it("returns messages matching a label (case-insensitive)", () => {
      const result = getMessagesByLabel(inboxSeedMessages, "security");
      expect(result.length).toBeGreaterThan(0);
      for (const msg of result) {
        expect(msg.labels.map((l) => l.toLowerCase())).toContain("security");
      }
    });

    it("returns empty array for a non-existent label", () => {
      expect(getMessagesByLabel(inboxSeedMessages, "nonexistent")).toEqual([]);
    });
  });

  describe("getMessagesBySender", () => {
    it("returns messages from a specific sender", () => {
      const result = getMessagesBySender(inboxSeedMessages, "eve@stealth.xyz");
      expect(result.length).toBeGreaterThan(0);
      for (const msg of result) {
        expect(msg.sender.address.toLowerCase()).toBe("eve@stealth.xyz");
      }
    });
  });

  describe("getMessagesByProofStatus", () => {
    it("returns messages with verified proof", () => {
      const result = getMessagesByProofStatus(inboxSeedMessages, "verified");
      expect(result.length).toBeGreaterThan(0);
      for (const msg of result) {
        expect(msg.proofRecord?.status).toBe("verified");
      }
    });

    it("returns messages with no proof record when status is 'none'", () => {
      const result = getMessagesByProofStatus(inboxSeedMessages, "none");
      for (const msg of result) {
        expect(msg.proofRecord).toBeUndefined();
      }
    });
  });

  describe("getMessagesByFolder", () => {
    it("returns messages assigned to the encrypted folder", () => {
      const result = getMessagesByFolder(inboxSeedMessages, "encrypted");
      expect(result).toHaveLength(4);
    });

    it("returns messages assigned to the requests folder", () => {
      const result = getMessagesByFolder(inboxSeedMessages, "requests");
      expect(result).toHaveLength(3);
    });
  });

  describe("getUnreadMessages / getStarredMessages", () => {
    it("unread filter only returns unread messages", () => {
      const result = getUnreadMessages(inboxSeedMessages);
      for (const msg of result) {
        expect(msg.isRead).toBe(false);
      }
    });

    it("starred filter only returns starred messages", () => {
      const result = getStarredMessages(inboxSeedMessages);
      for (const msg of result) {
        expect(msg.isStarred).toBe(true);
      }
    });
  });

  describe("attachment / calendar / snooze filters", () => {
    it("getMessagesWithAttachments returns only messages with attachments", () => {
      const result = getMessagesWithAttachments(inboxSeedMessages);
      expect(result.length).toBe(2);
      for (const msg of result) {
        expect(msg.attachments.length).toBeGreaterThan(0);
      }
    });

    it("getMessagesWithCalendarEvent returns messages with events", () => {
      const result = getMessagesWithCalendarEvent(inboxSeedMessages);
      expect(result).toHaveLength(2);
    });

    it("getSnoozedMessages returns snoozed messages", () => {
      const result = getSnoozedMessages(inboxSeedMessages);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("seed-msg-08");
    });
  });

  describe("sender queries", () => {
    it("getTrustedSenders returns only trusted senders", () => {
      const result = getTrustedSenders(inboxSeedSenders);
      for (const sender of result) {
        expect(sender.isTrusted).toBe(true);
      }
    });

    it("getUntrustedSenders returns only untrusted senders", () => {
      const result = getUntrustedSenders(inboxSeedSenders);
      for (const sender of result) {
        expect(sender.isTrusted).toBe(false);
      }
    });

    it("getRelaySenders returns senders with relay nodes", () => {
      const result = getRelaySenders(inboxSeedSenders);
      expect(result.length).toBeGreaterThan(0);
      for (const sender of result) {
        expect(sender.relayNode).toBeDefined();
      }
    });

    it("trusted + untrusted counts sum to total senders", () => {
      expect(
        getTrustedSenders(inboxSeedSenders).length + getUntrustedSenders(inboxSeedSenders).length,
      ).toBe(inboxSeedSenders.length);
    });
  });

  describe("collectLabels", () => {
    it("returns a sorted, de-duplicated list of labels", () => {
      const labels = collectLabels(inboxSeedMessages);
      const sorted = [...new Set(labels)].sort();
      expect(labels).toEqual(sorted);
      expect(labels.length).toBeGreaterThan(0);
    });
  });

  describe("computeFolderDistribution", () => {
    it("sums to the total message count", () => {
      const dist = computeFolderDistribution(inboxSeedMessages);
      const total = Object.values(dist).reduce((a, b) => a + b, 0);
      expect(total).toBe(inboxSeedMessages.length);
    });
  });

  describe("findMessageById / findSenderByAddress", () => {
    it("finds an existing message by id", () => {
      const msg = findMessageById(inboxSeedMessages, "seed-msg-01");
      expect(msg).toBeDefined();
      expect(msg?.subject).toContain("brand system");
    });

    it("returns undefined for a missing id", () => {
      expect(findMessageById(inboxSeedMessages, "no-such-id")).toBeUndefined();
    });

    it("finds a sender by address (case-insensitive)", () => {
      const sender = findSenderByAddress(inboxSeedSenders, "EVE@STEALTH.XYZ");
      expect(sender).toBeDefined();
      expect(sender?.name).toBe("Eve Navarro");
    });

    it("returns undefined for a missing address", () => {
      expect(findSenderByAddress(inboxSeedSenders, "nobody@example.com")).toBeUndefined();
    });
  });
});
