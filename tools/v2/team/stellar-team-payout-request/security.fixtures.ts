import type { PayoutRequest } from "./types";

/** A valid Stellar Ed25519-style address (56 chars, G-prefixed, base32). */
export const VALID_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
export const OTHER_VALID_ADDRESS = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

/** A well-formed payout request (passes hardening). */
export const VALID_PAYOUT: PayoutRequest = {
  source: VALID_ADDRESS,
  memo: "team payout Q3",
  recipients: [
    { address: OTHER_VALID_ADDRESS, amount: 1_000_000 },
    { address: VALID_ADDRESS, amount: 500_000 },
  ],
  idempotencyKey: "payout-2026-q3-001",
};

/** Missing idempotency key (should be flagged). */
export const MISSING_IDEMPOTENCY: PayoutRequest = {
  ...VALID_PAYOUT,
  idempotencyKey: "",
};

/** Malformed source address (should be flagged). */
export const BAD_SOURCE: PayoutRequest = {
  ...VALID_PAYOUT,
  source: "not-an-address",
};

/** A recipient with a negative amount (should be flagged). */
export const NEGATIVE_AMOUNT: PayoutRequest = {
  ...VALID_PAYOUT,
  recipients: [{ address: OTHER_VALID_ADDRESS, amount: -5 }],
};

/** Oversized recipient list (should be flagged). */
export const TOO_MANY_RECIPIENTS: PayoutRequest = {
  ...VALID_PAYOUT,
  recipients: Array.from({ length: 250 }, (_, i) => ({
    address: i % 2 ? OTHER_VALID_ADDRESS : VALID_ADDRESS,
    amount: 1,
  })),
};

/** Hostile memo with control bytes and oversize (should be flagged + sanitized). */
export const HOSTILE_MEMO: PayoutRequest = {
  ...VALID_PAYOUT,
  memo: "x".repeat(100),
};
