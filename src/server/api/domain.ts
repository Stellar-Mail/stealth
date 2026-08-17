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

/**
 * Request body accepted when replacing a mailbox policy. `requireReceipt` is
 * optional: when absent it defaults to false and is carried into the scheduled
 * on-chain write as `require_receipt = false`.
 */
export const mailboxPolicyWriteSchema = z.object({
  allowUnknown: z.boolean(),
  minimumPostage: stroopAmountSchema,
  requireVerified: z.boolean(),
  requireReceipt: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// BETA-023 (Issue #1930) — privacy-safe mailbox policy provisioning
//
// The on-chain Policies contract persists a four-field policy (including the
// delivery-receipt preference). The off-chain `MailboxPolicy` deliberately
// stays at three fields for backward compatibility with stored records and
// existing callers; the delivery-receipt preference and the off-chain policy
// version travel with the durable write intent that is scheduled for the
// matching testnet contract write.
// ---------------------------------------------------------------------------

export const chainMailboxPolicySchema = z.object({
  allowUnknown: z.boolean(),
  minimumPostage: stroopAmountSchema,
  requireReceipt: z.boolean(),
  requireVerified: z.boolean(),
});

export const policyWriteStatusSchema = z.enum(["pending", "submitted", "confirmed", "failed"]);

/**
 * Durable intent to write a mailbox policy to the Policies contract on
 * testnet. `offchainVersion` is the off-chain policy version: it is bumped
 * only when the effective policy actually changes, never on a retry of the
 * same policy — mirroring the contract's version-as-change-marker contract
 * without re-submitting an identical write (which the contract would still
 * count as a version bump).
 *
 * `lastError` is a redacted, bounded failure reason; wallet seeds, tokens and
 * transaction payloads never appear in it.
 */
export const policyWriteIntentSchema = z.object({
  owner: stellarAddressSchema,
  policy: chainMailboxPolicySchema,
  offchainVersion: z.number().int().nonnegative(),
  status: policyWriteStatusSchema,
  scheduledAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  failureCount: z.number().int().nonnegative().default(0),
  lastError: z.string().max(300).nullable().default(null),
  txHash: z.string().nullable().default(null),
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
export type ChainMailboxPolicy = z.infer<typeof chainMailboxPolicySchema>;
export type PolicyWriteIntent = z.infer<typeof policyWriteIntentSchema>;
export type PolicyWriteStatus = z.infer<typeof policyWriteStatusSchema>;
export type Postage = z.infer<typeof postageSchema>;
export type PostageStatus = z.infer<typeof postageStatusSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type SenderRule = z.infer<typeof senderRuleSchema>;

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

export const walletCapabilitySchema = z.enum(["sign", "send", "read"]);
export type WalletCapability = z.infer<typeof walletCapabilitySchema>;

export const externalWalletSchema = z.object({
  address: stellarAddressSchema,
  capabilities: z.array(walletCapabilitySchema).min(1),
  linkedAt: z.string().datetime(),
  network: z.string().min(1),
});

export type ExternalWallet = z.infer<typeof externalWalletSchema>;

export const externalWalletChallengeSchema = z.object({
  challenge: z.string().min(1),
  address: stellarAddressSchema,
  expiresAt: z.string().datetime(),
  network: z.string().min(1),
});

export type ExternalWalletChallenge = z.infer<typeof externalWalletChallengeSchema>;

export const networkPassphraseSchema = z.string().min(1);
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

// ---------------------------------------------------------------------------
// BETA-005: Verification token lifecycle domain
// ---------------------------------------------------------------------------

export const verificationPurposeSchema = z.enum(["email_verification"]);
export type VerificationPurpose = z.infer<typeof verificationPurposeSchema>;

export const verificationTokenHashSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-f0-9]{64}$/, "Expected a 64-character lowercase hexadecimal SHA-256 hash");

/**
 * Durable record for a single verification token.
 *
 * Security invariants (BETA-005):
 * - Only the SHA-256 hash of the token is ever persisted or logged. The
 *   plaintext token exists solely in the hand-off between the issuing service
 *   and the delivery adapter, and is never returned by the API.
 * - `consumedAt` is set exactly once under a per-token exclusive lock, making
 *   the token single-use even under concurrent verify requests.
 * - `replacedAt` marks a token invalidated by a newer issue (resend), so stale
 *   links fail closed.
 * - `attemptCount` counts failed verification attempts; reaching `maxAttempts`
 *   permanently locks the token (brute-force protection).
 */
export const verificationTokenSchema = z.object({
  tokenHash: verificationTokenHashSchema,
  userId: z.string().min(1, "User ID cannot be empty"),
  purpose: verificationPurposeSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
  replacedAt: z.string().datetime().nullable(),
  replacedByTokenHash: verificationTokenHashSchema.nullable().optional(),
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
});

export type VerificationToken = z.infer<typeof verificationTokenSchema>;

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

// ---------------------------------------------------------------------------
// BETA-006: Server-Side Session Domain
// ---------------------------------------------------------------------------

export const sessionSchema = z.object({
  sessionId: z.string().min(1, "Session ID cannot be empty"),
  userId: z.string().min(1, "User ID cannot be empty"),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lastActiveAt: z.string().datetime(),
  absoluteExpiresAt: z.string().datetime().optional(),
  rotatedFromSessionId: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  userAgent: z.string().optional().nullable(),
  deviceFingerprint: z.string().optional().nullable(),
});

export const publicSessionSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lastActiveAt: z.string().datetime(),
  absoluteExpiresAt: z.string().datetime().optional(),
});

export const retiredSessionSchema = z.object({
  sessionId: z.string().min(1, "Session ID cannot be empty"),
  replacedBySessionId: z.string().min(1, "Replaced by Session ID cannot be empty"),
  userId: z.string().min(1, "User ID cannot be empty"),
  retiredAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type Session = z.infer<typeof sessionSchema>;
export type PublicSession = z.infer<typeof publicSessionSchema>;
export type RetiredSession = z.infer<typeof retiredSessionSchema>;

export function toPublicSession(session: Session): PublicSession {
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    lastActiveAt: session.lastActiveAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
  };
}

// ---------------------------------------------------------------------------
// StoredEnvelope — durable encrypted-message record (Issue #1936 / BETA-029)
// ---------------------------------------------------------------------------

export const storedEnvelopeProtectedHeadersSchema = z
  .object({
    algorithm: z.string().optional(),
    ephemeral_public_key: z.string().optional(),
    nonce: z
      .string()
      .regex(/^[0-9a-fA-F]*$/)
      .refine((val) => val.length % 2 === 0, "Nonce must be even hex")
      .optional(),
    mac: z.string().optional(),
    version: z
      .string()
      .regex(/^v\d+$/, "Version must be v<digit>")
      .optional(),
    alg: z.string().optional(),
    kid: z.string().optional(),
    typ: z.string().optional(),
  })
  .catchall(z.unknown());

export const mailboxItemStatusSchema = z.enum(["pending", "delivered"]);
export type MailboxItemStatus = z.infer<typeof mailboxItemStatusSchema>;

export const storedEnvelopeSchema = z.object({
  envelopeId: z.string().optional(),
  messageId: hash32Schema,
  senderId: stellarAddressSchema,
  recipientId: stellarAddressSchema,
  ciphertext: z
    .string()
    .min(1, "Ciphertext cannot be empty")
    .max(20 * 1024 * 1024, "Ciphertext exceeds 20 MiB limit")
    .regex(/^[A-Za-z0-9+/=]+$/, "Ciphertext must be base64 encoded"),
  protectedHeaders: storedEnvelopeProtectedHeadersSchema,
  contentCommitment: hash32Schema.optional(),
  createdAt: z.string().datetime(),
  status: mailboxItemStatusSchema.default("pending"),
  deletedAt: z.string().datetime().nullable().optional(),
  objectRef: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type StoredEnvelopeProtectedHeaders = z.infer<typeof storedEnvelopeProtectedHeadersSchema>;
export type StoredEnvelope = z.infer<typeof storedEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Issue #1940 (BETA-033) — Authenticated Recipient Mailbox Queue Domain
// ---------------------------------------------------------------------------

export const mailboxQueueQuerySchema = z.object({
  recipient: stellarAddressSchema.optional(),
  status: z.enum(["pending", "delivered", "all"]).default("all"),
  includeTombstones: z.coerce.boolean().default(false),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type MailboxQueueQuery = z.infer<typeof mailboxQueueQuerySchema>;

export const mailboxDescriptorSchema = z.object({
  messageId: hash32Schema,
  senderId: stellarAddressSchema,
  recipientId: stellarAddressSchema,
  status: mailboxItemStatusSchema,
  createdAt: z.string().datetime(),
  protectedHeaders: storedEnvelopeProtectedHeadersSchema,
  contentCommitment: hash32Schema.optional(),
  objectRef: z.string().optional(),
  isTombstone: z.boolean(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export type MailboxDescriptor = z.infer<typeof mailboxDescriptorSchema>;

export const mailboxQueueResponseSchema = z.object({
  items: z.array(mailboxDescriptorSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type MailboxQueueResponse = z.infer<typeof mailboxQueueResponseSchema>;

export const tombstoneRequestSchema = z.object({
  messageId: hash32Schema,
});

export type TombstoneRequest = z.infer<typeof tombstoneRequestSchema>;

// ---------------------------------------------------------------------------
// BETA-027 (Issue #1934) — Versioned Public Encryption-Key Directory & Rotation
// ---------------------------------------------------------------------------

export const keyAlgorithmSchema = z.enum(["ed25519", "x25519", "secp256k1"]);
export const keyPurposeSchema = z.enum(["encryption", "signing", "device"]);
export const keyStatusSchema = z.enum(["active", "rotated", "retired", "revoked"]);

export type KeyAlgorithm = z.infer<typeof keyAlgorithmSchema>;
export type KeyPurpose = z.infer<typeof keyPurposeSchema>;
export type KeyStatus = z.infer<typeof keyStatusSchema>;

export const publishedKeySchema = z.object({
  keyId: z.string().min(1, "keyId cannot be empty"),
  owner: stellarAddressSchema,
  algorithm: keyAlgorithmSchema,
  purpose: keyPurposeSchema,
  publicKey: z
    .string()
    .min(1, "publicKey cannot be empty")
    .refine(
      (val) => !val.toLowerCase().includes("private") && !val.toLowerCase().includes("secret"),
      {
        message: "Private key material detected; only public keys are allowed",
      },
    ),
  version: z.number().int().positive(),
  notBefore: z.string().datetime(),
  notAfter: z.string().datetime(),
  status: keyStatusSchema,
  signature: z.string().min(1, "signature is required"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable().optional(),
  revocationReason: z.string().max(500).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type PublishedKey = z.infer<typeof publishedKeySchema>;

export const keyDirectoryRecordSchema = z.object({
  owner: stellarAddressSchema,
  currentEncryptionKeyId: z.string().nullable(),
  currentSigningKeyId: z.string().nullable(),
  keys: z.array(publishedKeySchema),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
});

export type KeyDirectoryRecord = z.infer<typeof keyDirectoryRecordSchema>;
