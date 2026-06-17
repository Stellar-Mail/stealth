import { z } from "zod";

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

export const deviceTypeSchema = z.enum(["desktop", "mobile", "tablet", "unknown"]);
export const keyStatusSchema = z.enum(["active", "compromised", "revoked", "rotated"]);

export const deviceSchema = z.object({
  id: z.string(),
  address: stellarAddressSchema,
  name: z.string(),
  type: deviceTypeSchema,
  fingerprint: z.string(),
  publicKey: z.string(),
  keyStatus: keyStatusSchema,
  trusted: z.boolean(),
  lastActive: z.string().datetime(),
  lastIp: z.string(),
  lastLocation: z.string(),
  createdAt: z.string().datetime(),
  isCurrent: z.boolean(),
});

export const sessionSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  address: stellarAddressSchema,
  startedAt: z.string().datetime(),
  lastActiveAt: z.string().datetime(),
  ip: z.string(),
  location: z.string(),
  isCurrent: z.boolean(),
  revokedAt: z.string().datetime().nullable(),
});

export const deviceCreateSchema = z.object({
  name: z.string().min(1).max(64),
  type: deviceTypeSchema,
  fingerprint: z.string(),
  publicKey: z.string(),
  lastIp: z.string(),
  lastLocation: z.string(),
});

export const deviceUpdateSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  trusted: z.boolean().optional(),
});

export const sessionRevokeSchema = z.object({
  deviceId: z.string(),
});

export type MailboxPolicy = z.infer<typeof mailboxPolicySchema>;
export type Postage = z.infer<typeof postageSchema>;
export type PostageStatus = z.infer<typeof postageStatusSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type SenderRule = z.infer<typeof senderRuleSchema>;
export type Device = z.infer<typeof deviceSchema>;
export type DeviceType = z.infer<typeof deviceTypeSchema>;
export type KeyStatus = z.infer<typeof keyStatusSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type DeviceCreate = z.infer<typeof deviceCreateSchema>;
export type DeviceUpdate = z.infer<typeof deviceUpdateSchema>;
