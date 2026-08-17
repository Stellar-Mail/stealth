import { z } from "zod";

import { stellarAddressSchema } from "../api/domain";

// ---------------------------------------------------------------------------
// BETA-024 (Issue #1931) — identity record schemas.
//
// The `user`, `session` and `username` families reuse the schemas already
// registered by BETA-002/BETA-006 in `src/server/api/domain.ts`. The
// `verification` and `wallet-metadata` families are the schema-governance
// contracts for identity records that later betas persist (BETA-007 session
// verification, BETA-014 wallet metadata); they are declared here so migration
// adapters and integrity checks have a versioned contract to validate against
// from the day the records land.
//
// No secrets are ever stored in these records: verification codes are hashed
// (never the raw code), and wallet metadata carries no private key material.
// ---------------------------------------------------------------------------

/** Index record: a secondary lookup key (`user:username:<name>`) points at a userId. */
export const usernameIndexSchema = z.string().min(1, "Username index value must be a userId");

export const verificationMethodSchema = z.enum(["otp", "passkey", "email", "wallet"]);
export type VerificationMethod = z.infer<typeof verificationMethodSchema>;

export const verificationStatusSchema = z.enum(["pending", "verified", "expired", "revoked"]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

/**
 * A verification attempt / outcome for a subject (a user, a relay, or a wallet
 * address). Only a digest of any code is stored — the plaintext code never
 * reaches durable storage.
 */
export const verificationSchema = z.object({
  verificationId: z.string().min(1, "Verification ID cannot be empty"),
  subject: z.string().min(1, "Verification subject cannot be empty"),
  method: verificationMethodSchema,
  status: verificationStatusSchema,
  /** Digest (e.g. SHA-256 hex) of the code/credential — never the raw value. */
  codeDigest: z
    .string()
    .regex(/^[a-f0-9]{16,64}$/i, "codeDigest must be a hex digest")
    .optional(),
  attempts: z.number().int().nonnegative().default(0),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  verifiedAt: z.string().datetime().optional().nullable(),
});

export const walletMetadataSchema = z.object({
  address: stellarAddressSchema,
  userId: z.string().optional().nullable(),
  displayName: z
    .string()
    .max(120, "Display name cannot exceed 120 characters")
    .optional()
    .nullable(),
  publicKeyRef: z
    .string()
    .max(256, "Public key reference cannot exceed 256 characters")
    .optional()
    .nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
