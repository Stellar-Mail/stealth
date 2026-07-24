/**
 * security.test.ts — hardening for Stellar Team Payout Request (#667).
 * Exercises hostile-input validation, amount/address/memo bounds, recipient
 * caps, and the batch performance guard. Pure; no network/secrets.
 */
import { describe, expect, it } from "vitest";

import {
  capBatch,
  hardenPayoutRequest,
  MAX_MEMO_CHARS,
  MAX_RECIPIENTS,
  totalAmount,
} from "./security";
import {
  BAD_SOURCE,
  HOSTILE_MEMO,
  MISSING_IDEMPOTENCY,
  NEGATIVE_AMOUNT,
  TOO_MANY_RECIPIENTS,
  VALID_ADDRESS,
  VALID_PAYOUT,
} from "./security.fixtures";

describe("stellar-team-payout-request hardening (#667)", () => {
  it("accepts a well-formed payout request", () => {
    const { issues } = hardenPayoutRequest(VALID_PAYOUT);
    expect(issues).toEqual([]);
  });

  it("flags a missing idempotency key", () => {
    const { issues } = hardenPayoutRequest(MISSING_IDEMPOTENCY);
    expect(issues.some((i) => i.field === "idempotencyKey")).toBe(true);
  });

  it("flags a malformed source address", () => {
    const { issues } = hardenPayoutRequest(BAD_SOURCE);
    expect(issues.some((i) => i.field === "source")).toBe(true);
  });

  it("flags negative / non-finite amounts", () => {
    const { issues } = hardenPayoutRequest(NEGATIVE_AMOUNT);
    expect(issues.some((i) => i.field.startsWith("recipients"))).toBe(true);
  });

  it("flags oversized recipient lists", () => {
    const { issues } = hardenPayoutRequest(TOO_MANY_RECIPIENTS);
    expect(issues.some((i) => i.field === "recipients")).toBe(true);
  });

  it("sanitizes and bounds a hostile memo", () => {
    const { value, issues } = hardenPayoutRequest(HOSTILE_MEMO);
    expect(issues.some((i) => i.field === "memo")).toBe(true);
    expect(value.memo?.length).toBe(MAX_MEMO_CHARS);
  });

  it("rejects garbage recipient addresses", () => {
    const { issues } = hardenPayoutRequest({
      source: VALID_ADDRESS,
      recipients: [{ address: "garbage", amount: 1 }],
      idempotencyKey: "k",
    });
    expect(issues.some((i) => i.field.startsWith("recipients"))).toBe(true);
  });

  it("capBatch bounds a recipient list to MAX_RECIPIENTS", () => {
    const big = Array.from({ length: 500 }, (_, i) => ({
      address: VALID_ADDRESS,
      amount: 1,
    }));
    expect(capBatch(big).length).toBe(MAX_RECIPIENTS);
  });

  it("totalAmount sums finite amounts only", () => {
    const recipients = [
      { address: VALID_ADDRESS, amount: 100 },
      { address: VALID_ADDRESS, amount: Number.NaN },
      { address: VALID_ADDRESS, amount: 50 },
    ];
    expect(totalAmount(recipients)).toBe(150);
  });
});
