import { z } from "zod";

export const stellarAddressSchema = z
  .string()
  .trim()
  .toUpperCase()
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

export const DEFAULT_RECEIPT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface ReceiptSchemaOptions {
  maxFutureSkewMs?: number;
  now?: () => Date;
}

export function createReceiptSchema(options: ReceiptSchemaOptions = {}) {
  const { maxFutureSkewMs = DEFAULT_RECEIPT_FUTURE_TOLERANCE_MS, now = () => new Date() } = options;

  return z
    .object({
      deliveredAt: z.string().datetime({ offset: true }),
      messageId: hash32Schema,
      readAt: z.string().datetime({ offset: true }).nullable(),
      recipient: stellarAddressSchema,
      sender: stellarAddressSchema,
    })
    .superRefine((data, ctx) => {
      const deliveredMs = Date.parse(data.deliveredAt);
      const referenceMs = now().getTime();
      const maxAllowedMs = referenceMs + maxFutureSkewMs;

      if (!isNaN(deliveredMs) && deliveredMs > maxAllowedMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Delivery timestamp is too far in the future",
          path: ["deliveredAt"],
        });
      }

      if (data.readAt !== null) {
        const readMs = Date.parse(data.readAt);

        if (!isNaN(readMs)) {
          if (!isNaN(deliveredMs) && readMs < deliveredMs) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Read time cannot precede delivery time",
              path: ["readAt"],
            });
          }

          if (readMs > maxAllowedMs) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Read timestamp is too far in the future",
              path: ["readAt"],
            });
          }
        }
      }
    });
}

export const receiptSchema = createReceiptSchema();

export type MailboxPolicy = z.infer<typeof mailboxPolicySchema>;
export type Postage = z.infer<typeof postageSchema>;
export type PostageStatus = z.infer<typeof postageStatusSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type SenderRule = z.infer<typeof senderRuleSchema>;

export const idempotencyRecordSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("in_progress"),
    createdAt: z.string().datetime(),
    recoveryExpiryAt: z.string().datetime(),
  }),
  z.object({
    state: z.literal("completed"),
    status: z.number(),
    body: z.unknown(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime(),
  }),
]);

export type IdempotencyRecord = z.infer<typeof idempotencyRecordSchema>;
