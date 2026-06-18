/**
 * Stellar Team Payout Request — Unit Tests
 *
 * Tests for PayoutService and validation helpers.
 * No live network calls. All external data is provided via fixtures.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PayoutService } from "../../../tools/v2/team/stellar-team-payout-request/services/payout.service";
import {
  isValidEmail,
  isValidAmount,
  isValidMemo,
  isValidStellarAccountId,
  validatePayoutFormData,
} from "../../../tools/v2/team/stellar-team-payout-request/services/validation";
import {
  mockValidFormData,
  MOCK_USER_ID,
  MOCK_STELLAR_ID,
  allMockPayouts,
} from "../../../tools/v2/team/stellar-team-payout-request/fixtures/mock-payouts";

// ── Validation helpers ────────────────────────────────────────────────────────

describe("isValidEmail", () => {
  it("accepts a well-formed email", () => {
    expect(isValidEmail("alice@example.com")).toBe(true);
  });

  it("rejects missing @ symbol", () => {
    expect(isValidEmail("aliceexample.com")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(isValidEmail("   ")).toBe(false);
  });
});

describe("isValidAmount", () => {
  it("accepts a whole number", () => {
    expect(isValidAmount("100")).toBe(true);
  });

  it("accepts up to 7 decimal places", () => {
    expect(isValidAmount("0.0000001")).toBe(true);
  });

  it("rejects zero", () => {
    expect(isValidAmount("0")).toBe(false);
  });

  it("rejects negative values", () => {
    expect(isValidAmount("-10")).toBe(false);
  });

  it("rejects more than 7 decimal places", () => {
    expect(isValidAmount("1.00000001")).toBe(false);
  });

  it("rejects non-numeric strings", () => {
    expect(isValidAmount("abc")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidAmount("")).toBe(false);
  });
});

describe("isValidMemo", () => {
  it("accepts a short memo", () => {
    expect(isValidMemo("Team payout Q1")).toBe(true);
  });

  it("accepts exactly 28 ASCII characters", () => {
    expect(isValidMemo("a".repeat(28))).toBe(true);
  });

  it("rejects a memo exceeding 28 bytes", () => {
    expect(isValidMemo("a".repeat(29))).toBe(false);
  });

  it("accepts an empty memo", () => {
    expect(isValidMemo("")).toBe(true);
  });
});

describe("isValidStellarAccountId", () => {
  it("accepts a valid-looking Stellar public key", () => {
    expect(isValidStellarAccountId(MOCK_STELLAR_ID)).toBe(true);
  });

  it("rejects a key that does not start with G", () => {
    expect(isValidStellarAccountId("SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN")).toBe(
      false,
    );
  });

  it("rejects a short key", () => {
    expect(isValidStellarAccountId("GABC")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidStellarAccountId("")).toBe(false);
  });
});

describe("validatePayoutFormData", () => {
  it("returns valid for correct form data", () => {
    const result = validatePayoutFormData(mockValidFormData);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns errors for empty recipientEmail", () => {
    const result = validatePayoutFormData({ ...mockValidFormData, recipientEmail: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty("recipientEmail");
  });

  it("returns errors for invalid amount", () => {
    const result = validatePayoutFormData({ ...mockValidFormData, amount: "-5" });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty("amount");
  });

  it("returns errors for a memo that is too long", () => {
    const result = validatePayoutFormData({ ...mockValidFormData, memo: "a".repeat(29) });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty("memo");
  });

  it("returns errors for an invalid scheduledFor date", () => {
    const result = validatePayoutFormData({ ...mockValidFormData, scheduledFor: "not-a-date" });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty("scheduledFor");
  });

  it("accepts undefined memo and scheduledFor", () => {
    const result = validatePayoutFormData({
      recipientEmail: "user@test.com",
      amount: "10",
    });
    expect(result.valid).toBe(true);
  });
});

// ── PayoutService ─────────────────────────────────────────────────────────────

describe("PayoutService", () => {
  let service: PayoutService;

  beforeEach(() => {
    service = new PayoutService();
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a pending request with valid data", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);

      expect(req.id).toBeDefined();
      expect(req.userId).toBe(MOCK_USER_ID);
      expect(req.recipientEmail).toBe(mockValidFormData.recipientEmail);
      expect(req.amount).toBe(mockValidFormData.amount);
      expect(req.status).toBe("pending");
      expect(req.createdAt).toBeDefined();
      expect(req.updatedAt).toBe(req.createdAt);
    });

    it("trims whitespace from email and amount", () => {
      const req = service.create(MOCK_USER_ID, {
        recipientEmail: "  alice@example.com  ",
        amount: "  50.00  ",
      });
      expect(req.recipientEmail).toBe("alice@example.com");
      expect(req.amount).toBe("50.00");
    });

    it("stores the memo when provided", () => {
      const req = service.create(MOCK_USER_ID, { ...mockValidFormData, memo: "Sprint bonus" });
      expect(req.memo).toBe("Sprint bonus");
    });

    it("omits memo when it is an empty string", () => {
      const req = service.create(MOCK_USER_ID, { ...mockValidFormData, memo: "" });
      expect(req.memo).toBeUndefined();
    });

    it("throws on invalid form data", () => {
      expect(() => service.create(MOCK_USER_ID, { recipientEmail: "bad", amount: "-1" })).toThrow();
    });

    it("attaches field errors to the thrown error", () => {
      try {
        service.create(MOCK_USER_ID, { recipientEmail: "bad", amount: "0" });
      } catch (err) {
        expect((err as { errors?: unknown }).errors).toBeDefined();
      }
    });

    it("generates unique IDs for each request", () => {
      const a = service.create(MOCK_USER_ID, mockValidFormData);
      const b = service.create(MOCK_USER_ID, mockValidFormData);
      expect(a.id).not.toBe(b.id);
    });
  });

  // ── getById ─────────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("returns the created request", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      const found = service.getById(req.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(req.id);
    });

    it("returns undefined for an unknown ID", () => {
      expect(service.getById("nonexistent")).toBeUndefined();
    });

    it("returns a copy — mutations do not affect the store", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      const copy = service.getById(req.id)!;
      copy.status = "confirmed"; // mutate the copy
      expect(service.getById(req.id)?.status).toBe("pending");
    });
  });

  // ── getByUser ───────────────────────────────────────────────────────────────

  describe("getByUser", () => {
    it("returns only requests belonging to the given user", () => {
      service.create(MOCK_USER_ID, mockValidFormData);
      service.create("other-user", mockValidFormData);
      const results = service.getByUser(MOCK_USER_ID);
      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe(MOCK_USER_ID);
    });

    it("returns empty array when user has no requests", () => {
      expect(service.getByUser("nobody")).toEqual([]);
    });
  });

  // ── getByStatus ─────────────────────────────────────────────────────────────

  describe("getByStatus", () => {
    it("returns only requests with the matching status", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      service.markSubmitted(req.id, "tx-001");
      const pending = service.getByStatus("pending");
      const submitted = service.getByStatus("submitted");
      expect(pending).toHaveLength(0);
      expect(submitted).toHaveLength(1);
    });
  });

  // ── markSubmitted ────────────────────────────────────────────────────────────

  describe("markSubmitted", () => {
    it("transitions pending → submitted and stores transactionId", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      const updated = service.markSubmitted(req.id, "tx-hash-001");

      expect(updated.status).toBe("submitted");
      expect(updated.transactionId).toBe("tx-hash-001");
      expect(updated.submittedAt).toBeDefined();
    });

    it("throws when payout does not exist", () => {
      expect(() => service.markSubmitted("nope", "tx")).toThrow("Payout not found");
    });

    it("throws when status is not pending", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      service.markSubmitted(req.id, "tx-001");
      expect(() => service.markSubmitted(req.id, "tx-002")).toThrow();
    });
  });

  // ── markConfirmed ────────────────────────────────────────────────────────────

  describe("markConfirmed", () => {
    it("transitions submitted → confirmed and records confirmedAt", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      service.markSubmitted(req.id, "tx-001");
      const confirmed = service.markConfirmed(req.id);

      expect(confirmed.status).toBe("confirmed");
      expect(confirmed.confirmedAt).toBeDefined();
    });

    it("throws when payout is not in submitted state", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      expect(() => service.markConfirmed(req.id)).toThrow();
    });
  });

  // ── markFailed ───────────────────────────────────────────────────────────────

  describe("markFailed", () => {
    it("transitions pending → failed with an error message", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      const failed = service.markFailed(req.id, "Destination account not found");

      expect(failed.status).toBe("failed");
      expect(failed.error).toBe("Destination account not found");
    });

    it("transitions submitted → failed", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      service.markSubmitted(req.id, "tx-001");
      const failed = service.markFailed(req.id, "Network timeout");
      expect(failed.status).toBe("failed");
    });

    it("throws when payout is already confirmed", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      service.markSubmitted(req.id, "tx-001");
      service.markConfirmed(req.id);
      expect(() => service.markFailed(req.id, "oops")).toThrow();
    });
  });

  // ── cancel ───────────────────────────────────────────────────────────────────

  describe("cancel", () => {
    it("transitions pending → cancelled", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      const cancelled = service.cancel(req.id);
      expect(cancelled.status).toBe("cancelled");
    });

    it("throws when payout is not pending", () => {
      const req = service.create(MOCK_USER_ID, mockValidFormData);
      service.markSubmitted(req.id, "tx-001");
      expect(() => service.cancel(req.id)).toThrow();
    });
  });

  // ── clear ─────────────────────────────────────────────────────────────────────

  describe("clear", () => {
    it("removes all stored requests", () => {
      service.create(MOCK_USER_ID, mockValidFormData);
      service.clear();
      expect(service.getByUser(MOCK_USER_ID)).toHaveLength(0);
    });
  });
});

// ── Fixtures sanity check ─────────────────────────────────────────────────────

describe("allMockPayouts fixture", () => {
  it("contains 5 deterministic entries", () => {
    expect(allMockPayouts).toHaveLength(5);
  });

  it("covers all payout statuses", () => {
    const statuses = allMockPayouts.map((p) => p.status);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("submitted");
    expect(statuses).toContain("confirmed");
    expect(statuses).toContain("failed");
    expect(statuses).toContain("cancelled");
  });

  it("has unique IDs", () => {
    const ids = allMockPayouts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
