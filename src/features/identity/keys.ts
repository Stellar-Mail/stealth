import { z } from "zod";
import { Keypair } from "@stellar/stellar-sdk";

export const keyAlgorithmSchema = z.enum(["ed25519", "x25519", "secp256k1"]);
export const keyPurposeSchema = z.enum(["encryption", "signing", "device"]);
export const keyStatusSchema = z.enum(["active", "rotated", "retired", "revoked"]);

export type KeyAlgorithm = z.infer<typeof keyAlgorithmSchema>;
export type KeyPurpose = z.infer<typeof keyPurposeSchema>;
export type KeyStatus = z.infer<typeof keyStatusSchema>;

export const stellarAddressSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^G[A-Z2-7]{55}$/, "Expected a Stellar G-address");

/**
 * Published public key stored in the directory.
 * Strictly contains only public material and verifiable cryptographic assertions.
 */
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

/**
 * Versioned directory root for an account's public keys.
 */
export const keyDirectoryRecordSchema = z.object({
  owner: stellarAddressSchema,
  currentEncryptionKeyId: z.string().nullable(),
  currentSigningKeyId: z.string().nullable(),
  keys: z.array(publishedKeySchema),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
});

export type KeyDirectoryRecord = z.infer<typeof keyDirectoryRecordSchema>;

/**
 * Request schema for publishing a new public key.
 */
export const publishKeyRequestSchema = z.object({
  keyId: z.string().optional(),
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
  notBefore: z.string().datetime().optional(),
  notAfter: z.string().datetime().optional(),
  signature: z.string().min(1, "Signature is required"),
  metadata: z.record(z.unknown()).optional(),
});

export type PublishKeyRequest = z.infer<typeof publishKeyRequestSchema>;

/**
 * Request schema for rotating an active key.
 */
export const rotateKeyRequestSchema = z.object({
  currentKeyId: z.string().min(1, "currentKeyId is required"),
  newKey: publishKeyRequestSchema,
  overlapPeriodMs: z.number().int().nonnegative().optional(),
  signature: z.string().min(1, "Signature is required"),
});

export type RotateKeyRequest = z.infer<typeof rotateKeyRequestSchema>;

/**
 * Request schema for retiring a key.
 */
export const retireKeyRequestSchema = z.object({
  keyId: z.string().min(1, "keyId is required"),
  reason: z.string().max(500).optional(),
  signature: z.string().optional(),
});

export type RetireKeyRequest = z.infer<typeof retireKeyRequestSchema>;

/**
 * Request schema for revoking a compromised or cancelled key.
 */
export const revokeKeyRequestSchema = z.object({
  keyId: z.string().min(1, "keyId is required"),
  reason: z.string().min(1, "Revocation reason is required").max(500),
  signature: z.string().min(1, "Signature is required"),
});

export type RevokeKeyRequest = z.infer<typeof revokeKeyRequestSchema>;

/**
 * Standardized response envelope for key directory queries.
 */
export const keyDirectoryResponseSchema = z.object({
  owner: stellarAddressSchema,
  currentKeys: z.object({
    encryption: publishedKeySchema.nullable().optional(),
    signing: publishedKeySchema.nullable().optional(),
  }),
  historicalKeys: z.array(publishedKeySchema),
  allKeys: z.array(publishedKeySchema),
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  freshness: z.object({
    resolvedAt: z.string().datetime(),
    cached: z.boolean(),
    ttlMs: z.number().int().nonnegative(),
  }),
});

export type KeyDirectoryResponse = z.infer<typeof keyDirectoryResponseSchema>;

/**
 * Generates the canonical payload bytes that must be signed by the account owner.
 */
export function buildKeyPublicationSigningPayload(params: {
  owner: string;
  keyId: string;
  algorithm: string;
  purpose: string;
  publicKey: string;
  version: number;
  notBefore: string;
  notAfter: string;
  operation?: string;
}): Uint8Array {
  const canonicalString = [
    "stealth:key-directory",
    params.operation ?? "publish",
    params.owner.trim().toUpperCase(),
    params.keyId.trim(),
    params.algorithm.trim().toLowerCase(),
    params.purpose.trim().toLowerCase(),
    params.publicKey.trim(),
    params.version.toString(),
    params.notBefore.trim(),
    params.notAfter.trim(),
  ].join("\n");

  return new TextEncoder().encode(canonicalString);
}

/**
 * Verifies that a signed key publication envelope was signed by the account owner.
 */
export function verifyKeyPublicationSignature(
  ownerAddress: string,
  signatureBase64OrHex: string,
  payload: Uint8Array,
): boolean {
  try {
    const keypair = Keypair.fromPublicKey(ownerAddress);
    let sigBuffer: Buffer;
    if (/^[0-9a-fA-F]+$/.test(signatureBase64OrHex) && signatureBase64OrHex.length === 128) {
      sigBuffer = Buffer.from(signatureBase64OrHex, "hex");
    } else {
      sigBuffer = Buffer.from(signatureBase64OrHex, "base64");
    }
    return keypair.verify(Buffer.from(payload), sigBuffer);
  } catch {
    return false;
  }
}

/**
 * Checks if a published key is valid for historical message verification at a given timestamp.
 * - Active / Rotated / Retired keys are valid if timestamp falls within [notBefore, notAfter].
 * - Revoked keys are valid ONLY for messages timestamped strictly BEFORE the revocation timestamp (revokedAt).
 */
export function isKeyValidAtTimestamp(key: PublishedKey, timestamp: Date | string): boolean {
  const t = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp.getTime();
  const notBeforeMs = new Date(key.notBefore).getTime();
  const notAfterMs = new Date(key.notAfter).getTime();

  if (Number.isNaN(t) || t < notBeforeMs || t > notAfterMs) {
    return false;
  }

  if (key.status === "revoked") {
    if (!key.revokedAt) return false;
    const revokedMs = new Date(key.revokedAt).getTime();
    return t < revokedMs;
  }

  return true;
}
