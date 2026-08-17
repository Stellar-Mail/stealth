import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  createReceiptSchema,
  hash32Schema,
  mailboxPolicySchema,
  postageSchema,
  stellarAddressSchema,
  stroopAmountSchema,
} from "../../../src/server/api/domain";
import {
  distinctAddressPairArbitrary,
  hash32Arbitrary,
  hash32UppercaseArbitrary,
  I128_MAX,
  instantMsArbitrary,
  invalidHash32Arbitrary,
  invalidStellarAddressArbitrary,
  invalidStroopAmountArbitrary,
  mailboxPolicyArbitrary,
  offsetTimestampArbitrary,
  postageArbitrary,
  stellarAddressArbitrary,
  stellarAddressUnnormalizedArbitrary,
  stroopAmountArbitrary,
  validReceiptArbitrary,
} from "./arbitraries";

// Bound property-test cost so the whole file stays well within CI's default
// per-test timeout even though each run exercises many generated inputs.
const NUM_RUNS = 200;

describe("stellarAddressSchema (property)", () => {
  it("accepts every generated canonical G-address", () => {
    fc.assert(
      fc.property(stellarAddressArbitrary, (address) => {
        expect(stellarAddressSchema.parse(address)).toBe(address);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("normalizes whitespace and case without changing the accepted value", () => {
    fc.assert(
      fc.property(stellarAddressUnnormalizedArbitrary, (raw) => {
        const parsed = stellarAddressSchema.parse(raw);
        expect(parsed).toBe(raw.trim().toUpperCase());
        expect(parsed).toMatch(/^G[A-Z2-7]{55}$/);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects every generated malformed address", () => {
    fc.assert(
      fc.property(invalidStellarAddressArbitrary, (address) => {
        expect(stellarAddressSchema.safeParse(address).success).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("hash32Schema (property)", () => {
  it("accepts every generated 64-char hex hash", () => {
    fc.assert(
      fc.property(hash32Arbitrary, (hash) => {
        expect(hash32Schema.parse(hash)).toBe(hash);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("normalizes mixed-case hex to lowercase", () => {
    fc.assert(
      fc.property(hash32UppercaseArbitrary, (hash) => {
        expect(hash32Schema.parse(hash)).toBe(hash.toLowerCase());
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects every generated malformed hash", () => {
    fc.assert(
      fc.property(invalidHash32Arbitrary, (hash) => {
        expect(hash32Schema.safeParse(hash).success).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("stroopAmountSchema (property)", () => {
  it("accepts every non-negative integer string up to the i128 boundary", () => {
    fc.assert(
      fc.property(stroopAmountArbitrary, (amount) => {
        expect(stroopAmountSchema.parse(amount)).toBe(amount);
        expect(BigInt(amount)).toBeLessThanOrEqual(I128_MAX);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("accepts the exact i128 boundary and rejects one past it", () => {
    expect(stroopAmountSchema.safeParse(I128_MAX.toString()).success).toBe(true);
    expect(stroopAmountSchema.safeParse((I128_MAX + 1n).toString()).success).toBe(false);
  });

  it("rejects every generated invalid amount (negative, overflow, leading zero, non-numeric)", () => {
    fc.assert(
      fc.property(invalidStroopAmountArbitrary, (amount) => {
        expect(stroopAmountSchema.safeParse(amount).success).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("mailboxPolicySchema (property)", () => {
  it("round-trips every generated valid policy", () => {
    fc.assert(
      fc.property(mailboxPolicyArbitrary, (policy) => {
        expect(mailboxPolicySchema.parse(policy)).toEqual(policy);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("postageSchema (property)", () => {
  it("accepts every generated valid postage record", () => {
    fc.assert(
      fc.property(postageArbitrary, (postage) => {
        expect(postageSchema.parse(postage)).toEqual(postage);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects postage.createdAt rendered with a numeric offset instead of Z", () => {
    fc.assert(
      fc.property(postageArbitrary, offsetTimestampArbitrary, (postage, offsetCreatedAt) => {
        const withOffset = { ...postage, createdAt: offsetCreatedAt };
        expect(postageSchema.safeParse(withOffset).success).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("receiptSchema timestamp ordering and future bounds (property)", () => {
  const NOW_MS = new Date("2026-01-01T00:00:00.000Z").getTime();
  const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
  const schema = createReceiptSchema({
    maxFutureSkewMs: MAX_FUTURE_SKEW_MS,
    now: () => new Date(NOW_MS),
  });

  it("accepts every generated receipt honoring ordering and future-skew invariants", () => {
    fc.assert(
      fc.property(validReceiptArbitrary(NOW_MS, MAX_FUTURE_SKEW_MS), (receipt) => {
        expect(schema.safeParse(receipt).success).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("also accepts offset-rendered timestamps representing the same valid instants", () => {
    fc.assert(
      fc.property(validReceiptArbitrary(NOW_MS, MAX_FUTURE_SKEW_MS), (receipt) => {
        const asOffset = {
          ...receipt,
          deliveredAt: toOffsetForm(receipt.deliveredAt),
          readAt: receipt.readAt === null ? null : toOffsetForm(receipt.readAt),
        };
        expect(schema.safeParse(asOffset).success).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects readAt strictly before deliveredAt, for any generated gap", () => {
    fc.assert(
      fc.property(
        hash32Arbitrary,
        distinctAddressPairArbitrary,
        fc.integer({ min: -60_000, max: MAX_FUTURE_SKEW_MS }),
        fc.integer({ min: 1, max: 60_000 }),
        (messageId, [recipient, sender], deliveredOffsetMs, gapMs) => {
          const deliveredAtMs = NOW_MS + deliveredOffsetMs;
          const readAtMs = deliveredAtMs - gapMs;
          const result = schema.safeParse({
            deliveredAt: new Date(deliveredAtMs).toISOString(),
            messageId,
            readAt: new Date(readAtMs).toISOString(),
            recipient,
            sender,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.join(".") === "readAt")).toBe(
              true,
            );
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects deliveredAt beyond the future-skew tolerance, and accepts exactly at the boundary", () => {
    fc.assert(
      fc.property(
        hash32Arbitrary,
        distinctAddressPairArbitrary,
        fc.integer({ min: 1, max: 10 * 365 * 24 * 60 * 60 * 1000 }),
        (messageId, [recipient, sender], overshootMs) => {
          const tooFarMs = NOW_MS + MAX_FUTURE_SKEW_MS + overshootMs;
          const rejected = schema.safeParse({
            deliveredAt: new Date(tooFarMs).toISOString(),
            messageId,
            readAt: null,
            recipient,
            sender,
          });
          expect(rejected.success).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );

    const boundaryMs = NOW_MS + MAX_FUTURE_SKEW_MS;
    const atBoundary = schema.safeParse({
      deliveredAt: new Date(boundaryMs).toISOString(),
      messageId: "a".repeat(64),
      readAt: null,
      recipient: `G${"A".repeat(55)}`,
      sender: `G${"B".repeat(55)}`,
    });
    expect(atBoundary.success).toBe(true);

    const pastBoundary = schema.safeParse({
      deliveredAt: new Date(boundaryMs + 1).toISOString(),
      messageId: "a".repeat(64),
      readAt: null,
      recipient: `G${"A".repeat(55)}`,
      sender: `G${"B".repeat(55)}`,
    });
    expect(pastBoundary.success).toBe(false);
  });
});

describe("timestamp round-trips (property)", () => {
  it("every generated UTC instant survives an ISO string round-trip", () => {
    fc.assert(
      fc.property(instantMsArbitrary, (ms) => {
        const iso = new Date(ms).toISOString();
        expect(Date.parse(iso)).toBe(ms);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("offset-rendered timestamps parse to the same instant as their UTC form", () => {
    fc.assert(
      fc.property(instantMsArbitrary, fc.integer({ min: -720, max: 720 }), (ms, offsetMinutes) => {
        const sign = offsetMinutes < 0 ? "-" : "+";
        const abs = Math.abs(offsetMinutes);
        const hh = String(Math.floor(abs / 60)).padStart(2, "0");
        const mm = String(abs % 60).padStart(2, "0");
        const localMs = ms + offsetMinutes * 60_000;
        const local = new Date(localMs).toISOString().replace("Z", `${sign}${hh}:${mm}`);
        expect(Date.parse(local)).toBe(ms);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

function toOffsetForm(iso: string): string {
  const ms = Date.parse(iso);
  const offsetMinutes = 60; // fixed +01:00 rendering
  return new Date(ms + offsetMinutes * 60_000).toISOString().replace("Z", "+01:00");
}
