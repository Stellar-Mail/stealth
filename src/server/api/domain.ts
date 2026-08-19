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
      payloadHash: hash32Schema.optional(),
      protocolVersion: z.number().int().positive().optional(),
      txHash: z.string().nullable().optional(),
      chainStatus: z.enum(["pending", "confirmed", "failed"]).nullable().optional(),
      ledgerSeq: z.number().int().nonnegative().nullable().optional(),
      confirmedAt: z.string().datetime({ offset: true }).nullable().optional(),
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

export const messageDeliveryStateSchema = z.enum([
  "queued",
  "accepted",
  "anchored",
  "delivered",
  "read",
  "failed",
  "expired",
]);

export type MessageDeliveryState = z.infer<typeof messageDeliveryStateSchema>;

export const TERMINAL_DELIVERY_STATES: ReadonlySet<MessageDeliveryState> = new Set([
  "read",
  "failed",
  "expired",
]);

export const RETRYABLE_DELIVERY_STATES: ReadonlySet<MessageDeliveryState> = new Set([
  "queued",
  "accepted",
  "anchored",
]);

export const ALLOWED_DELIVERY_TRANSITIONS: Record<
  MessageDeliveryState,
  ReadonlySet<MessageDeliveryState>
> = {
  queued: new Set(["accepted", "failed", "expired"]),
  accepted: new Set(["anchored", "delivered", "failed", "expired"]),
  anchored: new Set(["delivered", "failed", "expired"]),
  delivered: new Set(["read", "failed", "expired"]),
  read: new Set([]),
  failed: new Set([]),
  expired: new Set([]),
};

export const messageDeliveryTransitionSchema = z.object({
  fromState: messageDeliveryStateSchema.nullable(),
  toState: messageDeliveryStateSchema,
  timestamp: z.string().datetime(),
  actor: z.string().min(1),
  reason: z.string().min(1),
  chainReference: z.string().nullable().optional(),
});

export type MessageDeliveryTransition = z.infer<typeof messageDeliveryTransitionSchema>;

export const messageDeliveryStatusRecordSchema = z.object({
  messageId: hash32Schema,
  state: messageDeliveryStateSchema,
  isTerminal: z.boolean(),
  isRetryable: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  actor: z.string(),
  reason: z.string(),
  chainReference: z.string().nullable().optional(),
  history: z.array(messageDeliveryTransitionSchema),
});

export type MessageDeliveryStatusRecord = z.infer<typeof messageDeliveryStatusRecordSchema>;

export const publicDeliveryStatusSchema = z.object({
  messageId: hash32Schema,
  state: messageDeliveryStateSchema,
  isTerminal: z.boolean(),
  isRetryable: z.boolean(),
  observedAt: z.string().datetime(),
  actor: z.string(),
  reason: z.string(),
  chainReference: z.string().nullable().optional(),
  history: z.array(messageDeliveryTransitionSchema),
});

export type PublicDeliveryStatus = z.infer<typeof publicDeliveryStatusSchema>;

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

export const activeSignerSchema = z.object({
  signerType: z.enum(["external", "managed"]),
  address: stellarAddressSchema,
  capabilities: z.array(walletCapabilitySchema),
  isFallback: z.boolean(),
});

export type ActiveSigner = z.infer<typeof activeSignerSchema>;

export const managedWalletStatusSchema = z.object({
  address: stellarAddressSchema,
  status: z.enum(["active", "funded", "unfunded"]),
  network: z.string().min(1),
  balance: z.object({
    available: z.string().nullable(),
    balanceXlm: z.string().nullable(),
  }),
  capabilities: z.array(walletCapabilitySchema),
  isDefaultSigner: z.boolean(),
  activeSigner: activeSignerSchema,
});

export type ManagedWalletStatus = z.infer<typeof managedWalletStatusSchema>;

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

// ---------------------------------------------------------------------------
// BETA-015 (Issue #1922) — system-managed Stellar testnet wallet provisioning
//
// Public metadata and encrypted secret material are stored together under a
// user-scoped record. Plaintext seeds never reach durable storage, API
// responses, or logs — only the public Stellar address and funding status are
// exposed to clients.
// ---------------------------------------------------------------------------

export const managedWalletFundingStatusSchema = z.enum(["pending", "funded", "failed"]);
export type ManagedWalletFundingStatus = z.infer<typeof managedWalletFundingStatusSchema>;

export const encryptedWalletSecretSchema = z.object({
  ciphertext: z.string().min(1, "Encrypted ciphertext cannot be empty"),
  nonce: z.string().min(1, "Encrypted nonce cannot be empty"),
  tag: z.string().min(1, "Encrypted tag cannot be empty"),
  keyVersion: z.number().int().positive().default(1),
});

export type EncryptedWalletSecret = z.infer<typeof encryptedWalletSecretSchema>;

export const managedWalletRecordSchema = z.object({
  userId: z.string().min(1, "User ID cannot be empty"),
  address: stellarAddressSchema,
  /** Beta managed wallets are testnet-only. */
  network: z.literal("testnet"),
  fundingStatus: managedWalletFundingStatusSchema,
  encryptedSecret: encryptedWalletSecretSchema,
  fundedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastError: z.string().max(300).nullable().default(null),
});

export type ManagedWalletRecord = z.infer<typeof managedWalletRecordSchema>;

/** Client-safe wallet metadata — never includes seed material. */
export const publicManagedWalletSchema = z.object({
  address: stellarAddressSchema,
  network: z.literal("testnet"),
  fundingStatus: managedWalletFundingStatusSchema,
  provisioned: z.boolean(),
  fundedAt: z.string().datetime().nullable().optional(),
});

export type PublicManagedWallet = z.infer<typeof publicManagedWalletSchema>;

export function toPublicManagedWallet(
  wallet: ManagedWalletRecord,
  provisioned: boolean,
): PublicManagedWallet {
  return {
    address: wallet.address,
    network: wallet.network,
    fundingStatus: wallet.fundingStatus,
    provisioned,
    fundedAt: wallet.fundedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// BETA-018 (Issue #1925) — durable testnet funding operations
//
// One operation per account. Retries resume the same operationId so worker
// restarts never double-fund. Queue projections never include seed material.
// ---------------------------------------------------------------------------

export const fundingErrorClassSchema = z.enum(["transient", "permanent"]);
export type FundingErrorClass = z.infer<typeof fundingErrorClassSchema>;

export const fundingOperationStatusSchema = z.enum(["pending", "retrying", "succeeded", "failed"]);
export type FundingOperationStatus = z.infer<typeof fundingOperationStatusSchema>;

export const fundingOperationSchema = z.object({
  operationId: z.string().min(1, "Funding operation ID cannot be empty"),
  userId: z.string().min(1, "User ID cannot be empty"),
  address: stellarAddressSchema,
  status: fundingOperationStatusSchema,
  attempt: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  nextRetryAt: z.string().datetime().nullable().default(null),
  lastErrorClass: fundingErrorClassSchema.nullable().default(null),
  lastError: z.string().max(300).nullable().default(null),
  transactionId: z.string().max(128).nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FundingOperation = z.infer<typeof fundingOperationSchema>;

/** Administrator-visible queue item — never includes key material. */
export const publicFundingOperationSchema = fundingOperationSchema.omit({});
export type PublicFundingOperation = z.infer<typeof publicFundingOperationSchema>;

export function toPublicFundingOperation(operation: FundingOperation): PublicFundingOperation {
  return {
    operationId: operation.operationId,
    userId: operation.userId,
    address: operation.address,
    status: operation.status,
    attempt: operation.attempt,
    maxAttempts: operation.maxAttempts,
    nextRetryAt: operation.nextRetryAt,
    lastErrorClass: operation.lastErrorClass,
    lastError: operation.lastError,
    transactionId: operation.transactionId,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
  };
}

export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type User = z.infer<typeof userSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Credential = z.infer<typeof credentialSchema>;
export type CredentialAuthMethod = z.infer<typeof credentialAuthMethodSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;

// ---------------------------------------------------------------------------
// BETA-014: Transactional account-provisioning state machine
//
// A provisioning record is the durable, idempotent ledger for the account
// convergence flow: username reservation -> profile defaults -> wallet
// creation -> mailbox policy init. The user record only becomes "active"
// after every step completes, so a mid-flow failure can never leave a live
// half-account behind (the account stays pending_verification and the
// username reservation is released as compensation).
// ---------------------------------------------------------------------------

export const provisioningStatusSchema = z.enum(["pending", "retryable", "active", "failed"]);

export const provisioningStepSchema = z.enum([
  "username_reservation",
  "profile_defaults",
  "wallet_creation",
  "mailbox_policy_init",
]);

export const provisioningFailureSchema = z.object({
  step: provisioningStepSchema,
  code: z.string(),
  message: z.string(),
  failedAt: z.string().datetime(),
});

export const provisioningRecordSchema = z.object({
  userId: z.string().min(1, "User ID cannot be empty"),
  status: provisioningStatusSchema,
  requestedUsername: usernameSchema,
  displayName: z.string().trim().min(1, "Display name cannot be empty").nullable(),
  completedSteps: z.array(provisioningStepSchema),
  /** The step currently being attempted, or the step that failed last. */
  currentStep: provisioningStepSchema,
  attempts: z.number().int().nonnegative(),
  failure: provisioningFailureSchema.nullable(),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
});

/**
 * A wallet bound to exactly one account. The initial on-chain address is the
 * account's own Stellar address until an external wallet provider exists
 * (dependency BETA-013); the record exists so wallet creation is a durable,
 * insert-once provisioning step instead of an implicit side effect.
 */
export const walletSchema = z.object({
  walletId: z.string().min(1, "Wallet ID cannot be empty"),
  userId: z.string().min(1, "User ID cannot be empty"),
  address: stellarAddressSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * A leased claim on a username. Held for the duration of provisioning and
 * released as compensation when a later step fails, so a retry can re-claim
 * it and a failed account never leaks a permanently squatted username.
 */
export const usernameReservationSchema = z.object({
  username: usernameSchema,
  userId: z.string().min(1, "User ID cannot be empty"),
  reservedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type ProvisioningStatus = z.infer<typeof provisioningStatusSchema>;
export type ProvisioningStep = z.infer<typeof provisioningStepSchema>;
export type ProvisioningFailure = z.infer<typeof provisioningFailureSchema>;
export type ProvisioningRecord = z.infer<typeof provisioningRecordSchema>;
export type Wallet = z.infer<typeof walletSchema>;
export type UsernameReservation = z.infer<typeof usernameReservationSchema>;

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

export const unknownSenderRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "blocked",
  "expired",
]);
export const unknownSenderDecisionSchema = z.enum([
  "approve_once",
  "always_allow",
  "reject",
  "block",
  "expire",
]);
export const encryptedMessageReferenceSchema = z.object({
  messageId: hash32Schema,
  envelopeId: z.string().min(1).max(256).optional(),
  ciphertextHash: hash32Schema,
});
export const unknownSenderRequestSchema = z.object({
  requestId: z.string().uuid(),
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
  message: encryptedMessageReferenceSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  status: unknownSenderRequestStatusSchema,
  decidedAt: z.string().datetime().optional(),
  decision: unknownSenderDecisionSchema.optional(),
});
export type UnknownSenderRequest = z.infer<typeof unknownSenderRequestSchema>;
export type UnknownSenderDecision = z.infer<typeof unknownSenderDecisionSchema>;

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

// ---------------------------------------------------------------------------
// Issue #1973 (BETA-066) — Live contacts CRUD, trust state, and safe import
//
// A contact is a durable, user-owned address-book entry. `address` holds the
// raw identifier the user supplied (Stealth/Stellar G-address, local handle,
// or federation address); `canonicalAddress` is the resolved Stealth identity
// once identity resolution succeeds (null while unresolved or invalid).
// `trust` reuses the mailbox sender-rule vocabulary so contacts and policy
// stay consistent, but a contact row is NEVER an implicit policy mutation.
// ---------------------------------------------------------------------------

export const contactSourceSchema = z.enum(["manual", "csv", "vcard", "api"]);

export const contactSchema = z.object({
  contactId: z.string().trim().min(1),
  owner: stellarAddressSchema,
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(300),
  canonicalAddress: stellarAddressSchema.nullable().default(null),
  trust: senderRuleSchema.default("default"),
  source: contactSourceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
});

export const contactCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(300),
  trust: senderRuleSchema.default("default"),
});

export const contactUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().min(1).max(300).optional(),
    trust: senderRuleSchema.optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.name === undefined && data.address === undefined && data.trust === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one of name, address, or trust must be provided",
        path: [],
      });
    }
  });

export type Contact = z.infer<typeof contactSchema>;
export type ContactSource = z.infer<typeof contactSourceSchema>;
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;

// ---------------------------------------------------------------------------
// Issue #1952 (BETA-045) — Durable jobs, retries, DLQ, and receipt indexing
// ---------------------------------------------------------------------------

export const durableJobTypeSchema = z.enum([
  "funding",
  "anchoring",
  "postage",
  "delivery",
  "receipts",
  "cleanup",
  "reconciliation",
]);
export type DurableJobType = z.infer<typeof durableJobTypeSchema>;

export const jobStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "dead_letter",
  "abandoned",
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobErrorCodeSchema = z.enum([
  "ERR_NETWORK_TRANSIENT",
  "ERR_RPC_TIMEOUT",
  "ERR_RATE_LIMITED",
  "ERR_INSUFFICIENT_FUNDS",
  "ERR_CONTRACT_REVERT",
  "ERR_DOMAIN_NOT_FOUND",
  "ERR_UNAUTHORIZED",
  "ERR_PAYLOAD_REJECTED",
  "ERR_DELIVERY_EXPIRED",
  "ERR_POISON_PAYLOAD",
  "ERR_CHECKPOINT_GAP",
  "ERR_UNKNOWN_PERMANENT",
]);
export type JobErrorCode = z.infer<typeof jobErrorCodeSchema>;

export const durableJobSchema = z.object({
  jobId: z.string().trim().min(1),
  type: durableJobTypeSchema,
  idempotencyKey: z.string().trim().min(1),
  payload: z.record(z.unknown()),
  status: jobStatusSchema.default("pending"),
  attempts: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(5),
  backoffMs: z.number().int().positive().default(1000),
  nextRunAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  failedAt: z.string().datetime().optional(),
  lastError: z.string().max(500).optional(),
  errorCode: z.string().optional(),
  checkpoint: z.string().optional(),
});
export type DurableJob = z.infer<typeof durableJobSchema>;

export const deadLetterStatusSchema = z.enum(["dead", "retried", "abandoned"]);
export type DeadLetterStatus = z.infer<typeof deadLetterStatusSchema>;

export const deadLetterSchema = z.object({
  deadLetterId: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  jobType: durableJobTypeSchema,
  idempotencyKey: z.string().trim().min(1),
  payload: z.record(z.unknown()),
  attempts: z.number().int().nonnegative(),
  errorCode: z.string(),
  errorMessage: z.string(),
  deadLetteredAt: z.string().datetime(),
  status: deadLetterStatusSchema.default("dead"),
  retriedAt: z.string().datetime().optional(),
  abandonedAt: z.string().datetime().optional(),
  adminNotes: z.string().max(500).optional(),
});
export type DeadLetter = z.infer<typeof deadLetterSchema>;

export const receiptEventSchema = z.object({
  eventId: z.string().trim().min(1),
  streamId: z.string().trim().min(1),
  sequence: z.number().int().nonnegative(),
  messageId: hash32Schema,
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
  deliveredAt: z.string().datetime(),
  readAt: z.string().datetime().nullable().optional(),
});
export type ReceiptEvent = z.infer<typeof receiptEventSchema>;

export const receiptCheckpointSchema = z.object({
  streamId: z.string().trim().min(1),
  lastSequence: z.number().int().nonnegative(),
  processedCount: z.number().int().nonnegative(),
  lastIndexedAt: z.string().datetime(),
  gapCount: z.number().int().nonnegative().default(0),
});
export type ReceiptCheckpoint = z.infer<typeof receiptCheckpointSchema>;

// ---------------------------------------------------------------------------
// Issue #1954 (BETA-048) — Recoverable Send Operation State & Idempotency
// ---------------------------------------------------------------------------

export const sendOperationStatusSchema = z.enum([
  "created",
  "quoted",
  "escrowed",
  "submitted",
  "anchored",
  "delivered",
  "failed",
]);
export type SendOperationStatus = z.infer<typeof sendOperationStatusSchema>;

export const sendProofReferencesSchema = z.object({
  receiptId: z.string().optional(),
  anchorTxHash: z.string().optional(),
  postagePaymentHash: z.string().optional(),
  relayMessageId: z.string().optional(),
});
export type SendProofReferences = z.infer<typeof sendProofReferencesSchema>;

export const sendOperationStateSchema = z.object({
  version: z.number().int().positive().default(1),
  messageId: hash32Schema,
  sender: stellarAddressSchema,
  recipient: stellarAddressSchema,
  recipientDomain: z.string().default("stellar.network"),
  status: sendOperationStatusSchema.default("created"),
  quote: z.record(z.unknown()).optional(),
  postage: postageSchema.optional(),
  envelope: storedEnvelopeSchema.optional(),
  relaySubmission: z
    .object({
      accepted: z.boolean(),
      state: z.string(),
      attempts: z.number(),
    })
    .optional(),
  receipt: receiptSchema.optional(),
  anchorTxHash: z.string().optional(),
  proofReferences: sendProofReferencesSchema.optional(),
  idempotencyKey: z.string().min(1),
  failureReason: z.string().optional(),
  errorCode: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SendOperationState = z.infer<typeof sendOperationStateSchema>;
