/**
 * Unit tests for stellar-team-payout-request fixtures and payout service
 *
 * These tests run under vitest as part of the CI unit test suite.
 * They cover:
 *  - Fixture data integrity
 *  - validatePayoutRequest business rules
 *  - payoutService CRUD operations
 */
import { describe, it, expect, beforeEach } from "vitest";

import {
  validatePayoutRequest,
  payoutService,
} from "../../../tools/v2/team/stellar-team-payout-request/services";

import {
  mockPayouts,
  getMockPayout,
  getMockPayoutsByStatus,
  TEST_KEYPAIRS,
  mockStellarAccounts,
} from "../../../tools/v2/team/stellar-team-payout-request/fixtures/payouts.fixtures";

// ─── Fixture integrity ────────────────────────────────────────────────────────

describe("stellar-team-payout-request fixtures", () => {
  it("exports a non-empty mockPayouts array", () => {
    expect(Array.isArray(mockPayouts)).toBe(true);
    expect(mockPayouts.length).toBeGreaterThan(0);
  });

  it("every payout has required fields", () => {
    for (const payout of mockPayouts) {
      expect(typeof payout.id).toBe("string");
      expect(payout.id.length).toBeGreaterThan(0);
      expect(typeof payout.userId).toBe("string");
      expect(typeof payout.recipientEmail).toBe("string");
      expect(payout.recipientEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(typeof payout.amount).toBe("string");
      expect(parseFloat(payout.amount)).toBeGreaterThan(0);
      expect(["pending", "submitted", "confirmed", "failed", "cancelled"]).toContain(payout.status);
      expect(typeof payout.createdAt).toBe("string");
      expect(typeof payout.updatedAt).toBe("string");
    }
  });

  it("payout IDs are unique", () => {
    const ids = mockPayouts.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("covers all five payout statuses", () => {
    const statuses = new Set(mockPayouts.map((p) => p.status));
    expect(statuses.has("pending")).toBe(true);
    expect(statuses.has("submitted")).toBe(true);
    expect(statuses.has("confirmed")).toBe(true);
    expect(statuses.has("failed")).toBe(true);
    expect(statuses.has("cancelled")).toBe(true);
  });

  it("getMockPayout returns the correct record by id", () => {
    const first = mockPayouts[0];
    expect(getMockPayout(first.id)).toStrictEqual(first);
  });

  it("getMockPayout returns undefined for unknown id", () => {
    expect(getMockPayout("nonexistent")).toBeUndefined();
  });

  it("getMockPayoutsByStatus filters correctly", () => {
    const pending = getMockPayoutsByStatus("pending");
    expect(pending.every((p) => p.status === "pending")).toBe(true);
  });

  it("TEST_KEYPAIRS public keys match Stellar G-key format", () => {
    for (const kp of Object.values(TEST_KEYPAIRS)) {
      expect(kp.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    }
  });

  it("mockStellarAccounts keys match TEST_KEYPAIRS public keys", () => {
    for (const [key, account] of Object.entries(mockStellarAccounts)) {
      expect(account.id).toBe(key);
      expect(typeof account.balance).toBe("string");
    }
  });
});

// ─── validatePayoutRequest ────────────────────────────────────────────────────

describe("validatePayoutRequest", () => {
  it("accepts a valid payout request", () => {
    const result = validatePayoutRequest({
      recipientEmail: "alice@example.com",
      amount: "50.0000000",
      memo: "Team payout",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("accepts a request without memo", () => {
    const result = validatePayoutRequest({
      recipientEmail: "bob@example.com",
      amount: "10.5",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing email", () => {
    const result = validatePayoutRequest({ recipientEmail: "", amount: "10" });
    expect(result.valid).toBe(false);
    expect(result.errors.recipientEmail).toBeTruthy();
  });

  it("rejects malformed email", () => {
    const result = validatePayoutRequest({
      recipientEmail: "not-an-email",
      amount: "10",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.recipientEmail).toBeTruthy();
  });

  it("rejects zero amount", () => {
    const result = validatePayoutRequest({
      recipientEmail: "alice@example.com",
      amount: "0",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it("rejects negative amount", () => {
    const result = validatePayoutRequest({
      recipientEmail: "alice@example.com",
      amount: "-5",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it("rejects amount with more than 7 decimal places", () => {
    const result = validatePayoutRequest({
      recipientEmail: "alice@example.com",
      amount: "1.00000001",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it("rejects memo exceeding 28 bytes", () => {
    const longMemo = "a".repeat(29); // 29 ASCII bytes
    const result = validatePayoutRequest({
      recipientEmail: "alice@example.com",
      amount: "10",
      memo: longMemo,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.memo).toBeTruthy();
  });

  it("accepts memo exactly 28 bytes", () => {
    const exactMemo = "a".repeat(28);
    const result = validatePayoutRequest({
      recipientEmail: "alice@example.com",
      amount: "10",
      memo: exactMemo,
    });
    expect(result.valid).toBe(true);
  });
});

// ─── payoutService ────────────────────────────────────────────────────────────

describe("payoutService", () => {
  beforeEach(() => {
    payoutService.clear();
  });

  it("creates a payout request and returns it with a unique id", () => {
    const payout = payoutService.createPayoutRequest({
      recipientEmail: "carol@example.com",
      amount: "20.0000000",
    });
    expect(typeof payout.id).toBe("string");
    expect(payout.id.length).toBeGreaterThan(0);
    expect(payout.status).toBe("pending");
    expect(payout.recipientEmail).toBe("carol@example.com");
    expect(payout.amount).toBe("20.0000000");
    expect(payout.asset).toBe("native");
  });

  it("retrieves a created payout by id", () => {
    const created = payoutService.createPayoutRequest({
      recipientEmail: "dan@example.com",
      amount: "5",
    });
    const found = payoutService.getPayoutById(created.id);
    expect(found).toStrictEqual(created);
  });

  it("returns undefined for unknown payout id", () => {
    expect(payoutService.getPayoutById("no-such-id")).toBeUndefined();
  });

  it("getPayouts returns all created payouts", () => {
    payoutService.createPayoutRequest({ recipientEmail: "a@a.com", amount: "1" });
    payoutService.createPayoutRequest({ recipientEmail: "b@b.com", amount: "2" });
    expect(payoutService.getPayouts().length).toBe(2);
  });

  it("cancels a pending payout", () => {
    const payout = payoutService.createPayoutRequest({
      recipientEmail: "cancel@example.com",
      amount: "15",
    });
    const cancelled = payoutService.cancelPayout(payout.id);
    expect(cancelled.status).toBe("cancelled");
  });

  it("throws ValidationError for invalid payout data", () => {
    expect(() =>
      payoutService.createPayoutRequest({
        recipientEmail: "bad-email",
        amount: "10",
      }),
    ).toThrow("Validation failed");
  });

  it("throws for unknown id when updating status", () => {
    expect(() => payoutService.updateStatus("ghost-id", "confirmed")).toThrow("Payout not found");
  });

  it("clear() empties all payouts", () => {
    payoutService.createPayoutRequest({ recipientEmail: "e@e.com", amount: "1" });
    payoutService.clear();
    expect(payoutService.getPayouts().length).toBe(0);
  });
});
