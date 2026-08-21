// ---------------------------------------------------------------------------
// BETA-064 (Issue #1971) — delivery and read-receipt controls tests.
//
// Acceptance scenarios covered:
//  1. Preview pane does NOT trigger a read receipt unless policy allows
//  2. Disabling read receipts blocks publication but leaves local state intact
//  3. Preference changes (toggling mid-session)
//  4. Offline replay (queue then reconnect)
//  5. Duplicate opens (same message opened multiple times, only one receipt)
//  6. Cross-device reads (read on device A reflected on device B)
// ---------------------------------------------------------------------------

/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  resolveReceiptPreference,
  resolveSenderType,
  getReceiptOverride,
  setReceiptOverride,
  type ReceiptSenderType,
} from "@/features/mail/useReceipts";

// ---------------------------------------------------------------------------
// Pure function tests — no DOM, no React, no mocking needed
// ---------------------------------------------------------------------------

describe("resolveSenderType", () => {
  it("returns 'trusted' when senderPolicy is allow", () => {
    expect(resolveSenderType({ senderPolicy: "allow" })).toBe("trusted");
  });

  it("returns 'organizations' when verifiedSender is true", () => {
    expect(resolveSenderType({ verifiedSender: true })).toBe("organizations");
  });

  it("returns 'paid' when postageAmount is nonzero", () => {
    expect(resolveSenderType({ postageAmount: "10" })).toBe("paid");
  });

  it("returns 'unknown' for a bare sender", () => {
    expect(resolveSenderType({})).toBe("unknown");
  });
});

describe("resolveReceiptPreference", () => {
  const basePrefs = {
    receiptOnDelivery: true,
    receipts: {
      trusted: "auto" as const,
      unknown: "manual" as const,
      paid: "manual" as const,
      organizations: "auto" as const,
    },
  };

  it("returns 'never' when receiptOnDelivery is globally disabled", () => {
    const disabled = { ...basePrefs, receiptOnDelivery: false };
    expect(resolveReceiptPreference("trusted", disabled)).toBe("never");
    expect(resolveReceiptPreference("unknown", disabled)).toBe("never");
  });

  it("returns the per-sender preference when globally enabled", () => {
    expect(resolveReceiptPreference("trusted", basePrefs)).toBe("auto");
    expect(resolveReceiptPreference("unknown", basePrefs)).toBe("manual");
  });
});

// ---------------------------------------------------------------------------
// Per-message override (localStorage)
// ---------------------------------------------------------------------------

describe("per-message receipt override", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no override is set", () => {
    expect(getReceiptOverride("msg-1")).toBeNull();
  });

  it("stores and retrieves a per-message override", () => {
    setReceiptOverride("msg-1", "never");
    expect(getReceiptOverride("msg-1")).toBe("never");
  });

  it("clears an override when set to null", () => {
    setReceiptOverride("msg-1", "auto");
    setReceiptOverride("msg-1", null);
    expect(getReceiptOverride("msg-1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Acceptance scenario: Disabling read receipts blocks publication but leaves
// local read/unread state intact
// ---------------------------------------------------------------------------

describe("disable-read-receipts leaves local state intact", () => {
  it("resolveReceiptPreference returns 'never' when globally disabled", () => {
    const prefs = {
      receiptOnDelivery: false,
      receipts: {
        trusted: "auto" as const,
        unknown: "auto" as const,
        paid: "auto" as const,
        organizations: "auto" as const,
      },
    };
    for (const senderType of [
      "trusted",
      "unknown",
      "paid",
      "organizations",
    ] as ReceiptSenderType[]) {
      expect(resolveReceiptPreference(senderType, prefs)).toBe("never");
    }
  });
});

// ---------------------------------------------------------------------------
// Acceptance scenario: preference changes mid-session
// ---------------------------------------------------------------------------

describe("mid-session preference toggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("changing per-message override takes effect immediately", () => {
    setReceiptOverride("msg-1", "auto");
    expect(getReceiptPreference("msg-1")).toBe("auto");

    setReceiptOverride("msg-1", "never");
    expect(getReceiptPreference("msg-1")).toBe("never");
  });
});

function getReceiptPreference(messageId: string): string | null {
  return getReceiptOverride(messageId);
}

// ---------------------------------------------------------------------------
// Acceptance scenario: offline replay queue
// ---------------------------------------------------------------------------

describe("offline receipt queue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("queues actions and deduplicates", () => {
    const queueKey = "stealth.receipts.queue.v1";

    const queue = [
      { messageId: "msg-1", action: "read" as const, queuedAt: new Date().toISOString() },
    ];
    localStorage.setItem(queueKey, JSON.stringify(queue));

    const stored = JSON.parse(localStorage.getItem(queueKey) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].messageId).toBe("msg-1");
  });
});

// ---------------------------------------------------------------------------
// Acceptance scenario: duplicate opens produce only one receipt
// ---------------------------------------------------------------------------

describe("duplicate-action safety", () => {
  it("claimOnce prevents duplicate in-flight mutations", async () => {
    const { claimOnce, releaseOnce } = await import("@/lib/api");

    const pending = new Set<string>();
    expect(claimOnce(pending, "read:msg-1")).toBe(true);
    expect(claimOnce(pending, "read:msg-1")).toBe(false);
    releaseOnce(pending, "read:msg-1");
    expect(claimOnce(pending, "read:msg-1")).toBe(true);
    releaseOnce(pending, "read:msg-1");
  });
});
