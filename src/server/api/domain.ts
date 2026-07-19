import { z } from "zod";
import { ApiError } from "./errors";

export const stellarAddressSchema = z
  .string()
  .trim()
  .regex(/^G[A-Z2-7]{55}$/, "Expected a Stellar G-address");

export const hash32Schema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-f0-9]{64}$/, "Expected a 32-byte lowercase hexadecimal hash");

export const stroopAmountSchema = z
  .string()
  .trim()
  .regex(/^(0|[1-9]\d*)$/, "Expected a non-negative integer string")
  .refine((value) => {
    try {
      return BigInt(value) <= 2n ** 127n - 1n;
    } catch {
      return false;
    }
  }, "Amount exceeds Soroban i128");

export const senderRuleSchema = z.enum(["default", "allow", "block"]);
export const postageStatusSchema = z.enum(["pending", "settled", "refunded"]);

export const mailboxPolicySchema = z.object({
  allowUnknown: z.boolean(),
  minimumPostage: stroopAmountSchema,
  requireVerified: z.boolean(),
});

export const postageSchema = z.object({
  amount: stroopAmountSchema,
  createdAt: z.string().datetime(),
  messageId: hash32Schema,
  paymentHash: hash32Schema,
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
  status: postageStatusSchema,
});

export const receiptSchema = z.object({
  deliveredAt: z.string().datetime(),
  messageId: hash32Schema,
  readAt: z.string().datetime().nullable(),
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
});

export type MailboxPolicy = z.infer<typeof mailboxPolicySchema>;
export type Postage = z.infer<typeof postageSchema>;
export type PostageStatus = z.infer<typeof postageStatusSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type SenderRule = z.infer<typeof senderRuleSchema>;

export const idempotencyRecordSchema = z.object({
  status: z.number(),
  body: z.unknown(),
  createdAt: z.string().datetime(),
});

export type IdempotencyRecord = z.infer<typeof idempotencyRecordSchema>;

// ---------------------------------------------------------------------------
// Postage state machine
// ---------------------------------------------------------------------------

/**
 * Single source of truth for legal postage status transitions.
 *
 *   pending  → settled   (payment confirmed)
 *   pending  → refunded  (payment rejected / expired)
 *
 * `settled` and `refunded` are terminal states; no outbound transitions exist.
 */
export const POSTAGE_TRANSITIONS: Readonly<
  Record<PostageStatus, ReadonlySet<PostageStatus>>
> = {
  pending: new Set<PostageStatus>(["settled", "refunded"]),
  settled: new Set<PostageStatus>(),
  refunded: new Set<PostageStatus>(),
};

/**
 * Apply a status transition to a postage record, enforcing the documented
 * state machine.  Returns the updated postage on success.
 *
 * @throws {ApiError} 409 `conflict`        – postage is already in a terminal state
 * @throws {ApiError} 422 `validation_error` – transition is not in the documented matrix
 */
export function transitionPostage(postage: Postage, next: PostageStatus): Postage {
  const allowed = POSTAGE_TRANSITIONS[postage.status];

  if (postage.status === next) {
    // Requesting the same terminal state twice is still an error: the caller
    // must not assume idempotent re-resolution of settled/refunded postage.
    if (allowed.size === 0) {
      throw new ApiError(409, "conflict", "Postage has already been resolved", {
        current: postage.status,
        requested: next,
      });
    }
    return postage;
  }

  if (!allowed.has(next)) {
    if (allowed.size === 0) {
      // Terminal state — no further transitions are ever possible.
      throw new ApiError(409, "conflict", "Postage has already been resolved", {
        current: postage.status,
        requested: next,
      });
    }

    // Non-terminal state but still an undocumented transition.
    throw new ApiError(
      422,
      "validation_error",
      `Invalid postage transition: ${postage.status} \u2192 ${next}`,
      { current: postage.status, requested: next },
    );
  }

  return { ...postage, status: next };
}
