import { z } from "zod";

// Helper for Stellar address or identity format (supports G-addresses and test mocks)
export const stellarAddressSchema = z
  .string()
  .min(1, "Address/Identity must not be empty")
  .max(256, "Address/Identity must be at most 256 characters");

// Helper for hex strings of a specific length
export function hexStringSchema(lengthHex: number) {
  return z
    .string()
    .min(lengthHex, `Hex string must be exactly ${lengthHex} characters`)
    .max(lengthHex, `Hex string must be exactly ${lengthHex} characters`)
    .regex(/^[a-f0-9]+$/i, "Invalid hex character or casing");
}

// Encryption Metadata Schema
export const encryptionMetadataSchema = z
  .object({
    algorithm: z.literal("AES-256-GCM"),
    nonce: hexStringSchema(24), // 12 bytes = 24 hex characters
    mac: hexStringSchema(32), // 16 bytes = 32 hex characters
    ephemeral_public_key: z.string().min(1).max(256).optional(),
    recipient_key_id: z.string().min(1).max(256).optional(),
    sender_key_id: z.string().min(1).max(256).optional(),
  })
  .strict(); // Enforce no unknown metadata fields

// Envelope Attachment Schema
export const envelopeAttachmentSchema = z
  .object({
    filename: z.string().min(1).max(256),
    content_type: z.string().min(1).max(128),
    size_bytes: z
      .number()
      .int()
      .nonnegative()
      .max(10 * 1024 * 1024 * 1024), // max 10GB
    content_hash: hexStringSchema(64), // 32 bytes = 64 hex characters
    encryption_metadata: encryptionMetadataSchema.optional(),
    ciphertext: z
      .string()
      .min(1)
      .max(100 * 1024 * 1024) // max 100MB base64
      .regex(/^[A-Za-z0-9+/=]+$/)
      .optional(),
  })
  .strict();

// Known fields of the payload for checking critical fields
export const KNOWN_PAYLOAD_FIELDS = new Set([
  "version",
  "sender",
  "recipient",
  "timestamp",
  "encryption_metadata",
  "content_commitment",
  "attachments",
  "critical",
]);

// Content commitment schema: e.g. v1:sha256:hex:<64 hex chars>
export const contentCommitmentSchema = z
  .string()
  .min(10)
  .max(128)
  .regex(/^v[0-9]+:[a-zA-Z0-9]+:[a-zA-Z0-9]+:[a-f0-9]{64}$/, "Invalid content commitment format");

// Envelope Payload Schema
export const envelopePayloadSchema = z
  .object({
    version: z.string().min(1).max(10),
    sender: stellarAddressSchema,
    recipient: stellarAddressSchema,
    timestamp: z.string().min(1).max(64).datetime({ message: "Invalid ISO 8601 timestamp" }),
    encryption_metadata: encryptionMetadataSchema,
    content_commitment: contentCommitmentSchema,
    attachments: z.array(envelopeAttachmentSchema).max(100),
    critical: z.array(z.string().min(1).max(64)).max(20).optional(),
  })
  .passthrough() // Allow unknown fields for extensibility, but:
  .superRefine((data, ctx) => {
    // Fail closed on unknown critical fields
    if (data.critical && data.critical.length > 0) {
      for (const field of data.critical) {
        if (!KNOWN_PAYLOAD_FIELDS.has(field)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown mandatory critical field: ${field}`,
            path: ["critical"],
          });
        }
      }
    }
  });

// Sealed Envelope Schema
export const sealedEnvelopeSchema = z
  .object({
    payload: envelopePayloadSchema,
    ciphertext: z
      .string()
      .min(1)
      .max(20 * 1024 * 1024) // max 20MB base64
      .regex(/^[A-Za-z0-9+/=]+$/, "Invalid base64 encoding"),
  })
  .strict();

// Envelope Signature Schema
export const envelopeSignatureSchema = z
  .object({
    scheme: z.literal("Ed25519"),
    signerAddress: stellarAddressSchema,
    value: hexStringSchema(128), // 64 bytes = 128 hex characters
  })
  .strict();
