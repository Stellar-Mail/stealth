import { z } from "zod";

// ---------------------------------------------------------------------------
// StoredEnvelope — durable encrypted-message record (Issue #1936 BETA-029)
// Plaintext (subject, body) is intentionally absent from this schema.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Issue #1910: canonical username reservation record.
//
// `username` is always the already-canonicalized value (see
// src/features/identity/username.ts) — this schema does not re-derive
// canonicalization, it only shapes the persisted record.
// ---------------------------------------------------------------------------

export const usernameRecordSchema = z.object({
  username: z.string().min(1).max(64),
  ownerAddress: stellarAddressSchema,
  stealthAddress: z.string().min(1).max(128),
  federationAddress: z.string().min(1).max(128),
  createdAt: z.string().datetime(),
});

export type UsernameRecord = z.infer<typeof usernameRecordSchema>;

export const idempotencyRecordSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("in_progress"),
    // Issue #1498: canonical digest of the request that acquired this lease,
    // so a same-key-different-payload retry is detected as a conflict
    // instead of blocking behind (or later replaying) an unrelated request.
    requestDigest: z.string(),
    createdAt: z.string().datetime(),
    recoveryExpiryAt: z.string().datetime(),
  }),
  z.object({
    state: z.literal("completed"),
    status: z.number(),
    body: z.unknown(),
    requestDigest: z.string(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime(),
  }),
]);

export type IdempotencyRecord = z.infer<typeof idempotencyRecordSchema>;

// ---------------------------------------------------------------------------
// BETA-002: Durable User Account, Profile, Credential & AccountStatus Domain
// ---------------------------------------------------------------------------

export const accountStatusSchema = z.enum([
  "active",
  "suspended",
  "pending_verification",
  "deactivated",
]);

export const emailSchema = z.string().trim().toLowerCase().email("Expected a valid email address");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_-]{3,30}$/,
    "Username must be 3-30 lowercase alphanumeric characters, underscores, or hyphens",
  );

export const userSchema = z.object({
  userId: z.string().min(1, "User ID cannot be empty"),
  address: stellarAddressSchema,
  email: emailSchema,
  username: usernameSchema,
  status: accountStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
});

export const profileSchema = z.object({
  userId: z.string().min(1, "User ID cannot be empty"),
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Display name cannot be empty"),
  avatarUrl: z.string().url("Avatar URL must be a valid URL").nullable().optional(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters").nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const credentialAuthMethodSchema = z.enum([
  "stellar_header",
  "passkey",
  "password_hash",
  "delegation",
]);

export const credentialSchema = z.object({
  credentialId: z.string().min(1, "Credential ID cannot be empty"),
  userId: z.string().min(1, "User ID cannot be empty"),
  authMethod: credentialAuthMethodSchema,
  secretHash: z.string().min(1, "Secret hash cannot be empty"),
  walletKeyRef: z.string().min(1, "Wallet key ref cannot be empty"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const publicUserSchema = z.object({
  userId: z.string(),
  address: stellarAddressSchema,
  email: emailSchema,
  username: usernameSchema,
  status: accountStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const publicProfileSchema = z.object({
  userId: z.string(),
  username: usernameSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type User = z.infer<typeof userSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Credential = z.infer<typeof credentialSchema>;
export type CredentialAuthMethod = z.infer<typeof credentialAuthMethodSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;

export function toPublicUser(user: User): PublicUser {
  return {
    userId: user.userId,
    address: user.address,
    email: user.email,
    username: user.username,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toPublicProfile(profile: Profile): PublicProfile {
  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? null,
    bio: profile.bio ?? null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Zod schema for a durably stored encrypted message envelope.
 *
 * Design principles
 * -----------------
 * - `ciphertext`        : the raw encrypted body (base64url), never decrypted here.
 * - `protectedHeaders`  : immutable encryption metadata stored alongside ciphertext
 *                         (algorithm, ephemeral key, nonce, MAC) so the data needed
 *                         to decrypt is co-located with the ciphertext.
 * - `contentCommitment` : SHA-256 hex commitment over the plaintext, allowing
 *                         integrity verification without storing plaintext.
 * - `senderId`          : Stellar G-address of the originating party.
 * - `recipientId`       : Stellar G-address of the intended recipient — used as
 *                         the primary index for mailbox sync without indexing plaintext.
 * - `createdAt`         : ISO-8601 insertion timestamp set by the server.
 * - `$v`                : schema version for future migrations (starts at 1).
 *
 * Plaintext (`subject`, `body`) is **never** a field of this record.
 */
export const storedEnvelopeProtectedHeadersSchema = z.object({
  algorithm: z.string().min(1).max(64),
  ephemeral_public_key: stellarAddressSchema,
  nonce: z
    .string()
    .regex(/^[a-f0-9]+$/, "Expected a hex string for nonce")
    .min(2)
    .max(128),
  mac: hash32Schema,
  version: z.string().regex(/^v[0-9]+$/),
});

export const storedEnvelopeSchema = z.object({
  /** Immutable unique message identifier — 32-byte lowercase hex. */
  messageId: hash32Schema,
  /** Stellar G-address of the sender. */
  senderId: stellarAddressSchema,
  /** Stellar G-address of the recipient — used as the mailbox index. */
  recipientId: stellarAddressSchema,
  /**
   * Encrypted body ciphertext.
   * Base64url-encoded, no padding (RFC 4648 §5). Plaintext is never stored.
   */
  ciphertext: z
    .string()
    .min(1, "Ciphertext must not be empty")
    .max(20 * 1024 * 1024, "Ciphertext exceeds 20 MiB limit")
    .regex(/^[A-Za-z0-9+/=]+$/, "Ciphertext must be valid base64"),
  /** Encryption metadata required for decryption; immutable after insert. */
  protectedHeaders: storedEnvelopeProtectedHeadersSchema,
  /**
   * Hex-encoded SHA-256 commitment over the plaintext body.
   * Enables integrity verification without storing plaintext.
   */
  contentCommitment: hash32Schema,
  /** ISO-8601 server-side insertion timestamp. */
  createdAt: z.string().datetime(),
  /** Schema version for future migrations. */
  $v: z.number().int().min(1).optional(),
});

export type StoredEnvelopeProtectedHeaders = z.infer<typeof storedEnvelopeProtectedHeadersSchema>;
export type StoredEnvelope = z.infer<typeof storedEnvelopeSchema>;
