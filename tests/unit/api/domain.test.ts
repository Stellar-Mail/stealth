import { describe, expect, it } from "vitest";

import {
  POSTAGE_TRANSITIONS,
  hash32Schema,
  mailboxPolicySchema,
  makeStroopAmountSchema,
  postageStatusSchema,
  stellarAddressSchema,
  stroopAmountSchema,
  transitionPostage,
} from "../../../src/server/api/domain";
import type { Postage, PostageStatus } from "../../../src/server/api/domain";

const address = `G${"A".repeat(55)}`;

const makePostage = (status: PostageStatus): Postage => ({
  amount: "100",
  createdAt: "2026-06-14T12:00:00.000Z",
  messageId: "a".repeat(64),
  paymentHash: "b".repeat(64),
  recipient: `G${"A".repeat(55)}`,
  sender: `G${"B".repeat(55)}`,
  status,
});

describe("API domain schemas", () => {
  it("accepts contract-safe policy values", () => {
    expect(
      mailboxPolicySchema.parse({
        allowUnknown: false,
        minimumPostage: "10000000",
        requireVerified: true,
      }),
    ).toEqual({
      allowUnknown: false,
      minimumPostage: "10000000",
      requireVerified: true,
    });
  });

  it("enforces Stellar addresses and 32-byte hashes", () => {
    expect(stellarAddressSchema.parse(address)).toBe(address);
    // Add normalization tests for canonical address handling
    expect(stellarAddressSchema.parse(address.toLowerCase())).toBe(address);
    expect(stellarAddressSchema.parse(`  ${address.toLowerCase()}  `)).toBe(address);

    expect(hash32Schema.parse("a".repeat(64))).toBe("a".repeat(64));
    expect(() => stellarAddressSchema.parse("eve*stealth.xyz")).toThrow();
    expect(() => hash32Schema.parse("abc")).toThrow();
  });

  it("keeps Soroban i128 amounts as decimal strings", () => {
    expect(stroopAmountSchema.parse("9007199254740993")).toBe("9007199254740993");
    expect(() => stroopAmountSchema.parse("-1")).toThrow();
  });

  describe("stroopAmountSchema — boundary conditions", () => {
    const MAX_I128 = "170141183460469231731687303715884105727"; // 2^127-1, 39 digits
    const OVERFLOW_I128 = "170141183460469231731687303715884105728"; // 2^127, 39 digits
    const OVERFLOW_LONG = "1" + "0".repeat(39); // 41 chars — pre-parse length guard fires

    it("accepts zero — minimum valid amount", () => {
      expect(stroopAmountSchema.parse("0")).toBe("0");
    });

    it("accepts max i128 (2^127-1) — type-level ceiling", () => {
      expect(stroopAmountSchema.parse(MAX_I128)).toBe(MAX_I128);
    });

    it("rejects strings longer than 39 digits before BigInt conversion", () => {
      const result = stroopAmountSchema.safeParse(OVERFLOW_LONG);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Amount exceeds Soroban i128");
      }
    });

    it("rejects 2^127 (40-digit overflow) with stable i128 error", () => {
      const result = stroopAmountSchema.safeParse(OVERFLOW_I128);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Amount exceeds Soroban i128");
      }
    });
  });

  describe("makeStroopAmountSchema — business maximum", () => {
    const cap = "5000000000"; // 50 XLM in stroops
    const capped = makeStroopAmountSchema(cap);

    it("accepts zero under the business cap", () => {
      expect(capped.parse("0")).toBe("0");
    });

    it("accepts the exact business cap", () => {
      expect(capped.parse(cap)).toBe(cap);
    });

    it("rejects one stroop over the business cap with stable code", () => {
      const result = capped.safeParse("5000000001");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Amount exceeds business maximum");
      }
    });

    it("still rejects values above i128 even with a business cap", () => {
      const result = capped.safeParse("170141183460469231731687303715884105728");
      expect(result.success).toBe(false);
      if (!result.success) {
        // i128 check fires first
        expect(result.error.issues[0].message).toBe("Amount exceeds Soroban i128");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Postage state machine — transition matrix
// ---------------------------------------------------------------------------

const ALL_STATUSES = postageStatusSchema.options as PostageStatus[];

/**
 * Full 3×3 transition matrix.  Each row is [from, to, expectation].
 * Expectation is either "ok" (returns updated Postage) or the HTTP status
 * code that the domain error must carry.
 */
const TRANSITION_TABLE: Array<[PostageStatus, PostageStatus, "ok" | 409 | 422]> = [
  // ── from pending ───────────────────────────────────────────────────────────
  ["pending", "pending", "ok"], // idempotent self-transition while non-terminal
  ["pending", "settled", "ok"],
  ["pending", "refunded", "ok"],
  // ── from settled (terminal) ────────────────────────────────────────────────
  ["settled", "pending", 409],
  ["settled", "settled", 409],
  ["settled", "refunded", 409],
  // ── from refunded (terminal) ───────────────────────────────────────────────
  ["refunded", "pending", 409],
  ["refunded", "settled", 409],
  ["refunded", "refunded", 409],
];

describe("postage state machine", () => {
  describe("POSTAGE_TRANSITIONS — documented graph", () => {
    it("pending allows settled and refunded only", () => {
      expect([...POSTAGE_TRANSITIONS.pending]).toEqual(
        expect.arrayContaining(["settled", "refunded"]),
      );
      expect(POSTAGE_TRANSITIONS.pending.size).toBe(2);
    });

    it("settled is terminal — no outbound transitions", () => {
      expect(POSTAGE_TRANSITIONS.settled.size).toBe(0);
    });

    it("refunded is terminal — no outbound transitions", () => {
      expect(POSTAGE_TRANSITIONS.refunded.size).toBe(0);
    });

    it("every status key is represented", () => {
      expect(Object.keys(POSTAGE_TRANSITIONS).sort()).toEqual([...ALL_STATUSES].sort());
    });
  });

  describe("transitionPostage — full transition matrix", () => {
    it.each(TRANSITION_TABLE)(
      "%s → %s should be %s",
      (from, to, expected) => {
        const postage = makePostage(from);

        if (expected === "ok") {
          const result = transitionPostage(postage, to);
          expect(result.status).toBe(to);
          // Immutability: original object must not be mutated
          expect(postage.status).toBe(from);
        } else {
          expect(() => transitionPostage(postage, to)).toThrow(
            expect.objectContaining({ status: expected }),
          );
        }
      },
    );
  });

  describe("transitionPostage — invariant assertions", () => {
    it("terminal states cannot return to pending", () => {
      for (const terminal of ["settled", "refunded"] as const) {
        expect(() => transitionPostage(makePostage(terminal), "pending")).toThrow(
          expect.objectContaining({ status: 409, code: "conflict" }),
        );
      }
    });

    it("terminal-state self-transitions throw 409 conflict", () => {
      for (const terminal of ["settled", "refunded"] as const) {
        expect(() => transitionPostage(makePostage(terminal), terminal)).toThrow(
          expect.objectContaining({ status: 409, code: "conflict" }),
        );
      }
    });

    it("successful transition returns new Postage without mutating the original", () => {
      const original = makePostage("pending");
      const settled = transitionPostage(original, "settled");

      expect(settled).toEqual({ ...original, status: "settled" });
      expect(original.status).toBe("pending");
    });

    it("settled cannot cross to refunded — 409 conflict", () => {
      expect(() => transitionPostage(makePostage("settled"), "refunded")).toThrow(
        expect.objectContaining({ status: 409, code: "conflict" }),
      );
    });

    it("refunded cannot cross to settled — 409 conflict", () => {
      expect(() => transitionPostage(makePostage("refunded"), "settled")).toThrow(
        expect.objectContaining({ status: 409, code: "conflict" }),
      );
    });
  });
});
