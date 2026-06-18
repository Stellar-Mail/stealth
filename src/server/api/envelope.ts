import { z } from "zod";
import { stellarAddressSchema, hash32Schema } from "./domain";

export const encryptionMetadataSchema = z.object({
  algorithm: z.string(),
  ephemeral_public_key: stellarAddressSchema,
  nonce: z.string().regex(/^[a-f0-9]+$/, "Expected a hex string for nonce"),
  mac: hash32Schema,
});

export const attachmentMetadataSchema = z.object({
  filename: z.string(),
  content_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  content_hash: hash32Schema,
});

export const envelopePayloadSchema = z
  .object({
    version: z.string().regex(/^v[0-9]+$/),
    sender: stellarAddressSchema,
    recipient: stellarAddressSchema,
    timestamp: z.string().datetime(),
    encryption_metadata: encryptionMetadataSchema,
    content_commitment: hash32Schema,
    attachments: z.array(attachmentMetadataSchema),
    critical: z.array(z.string()).optional(),
  })
  .passthrough(); // Allow unknown fields for extensibility

export const envelopeSignatureSchema = z.object({
  scheme: z.enum(["Ed25519"]),
  value: z.string().regex(/^[a-f0-9]{128}$/, "Expected a 64-byte (128 hex chars) signature"),
});

export const envelopeSchema = z.object({
  payload: envelopePayloadSchema,
  signature: envelopeSignatureSchema,
});

export type EnvelopePayload = z.infer<typeof envelopePayloadSchema>;
export type EnvelopeSignature = z.infer<typeof envelopeSignatureSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;

/**
 * Standard known fields of the envelope payload.
 * Any field in the `critical` array not in this list causes validation to fail closed.
 */
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

/**
 * Serializes any JSON-compatible value to its canonical JCS (RFC 8785) representation.
 */
export function canonicalize(val: any): string {
  if (val === null) {
    return "null";
  }
  if (typeof val === "boolean" || typeof val === "number") {
    return JSON.stringify(val);
  }
  if (typeof val === "string") {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return "[" + val.map(canonicalize).join(",") + "]";
  }
  if (typeof val === "object") {
    const keys = Object.keys(val).sort();
    const parts = keys.map((key) => {
      return JSON.stringify(key) + ":" + canonicalize(val[key]);
    });
    return "{" + parts.join(",") + "}";
  }
  throw new Error(`Unsupported type for canonical serialization: ${typeof val}`);
}

/**
 * Validates the envelope structure and enforces that any unknown critical fields
 * fail validation (fail closed).
 */
export function validateEnvelope(data: unknown): Envelope {
  // 1. Structural validation using Zod
  const parsed = envelopeSchema.parse(data);

  // 2. Fail closed on unknown critical fields
  if (parsed.payload.critical && parsed.payload.critical.length > 0) {
    for (const field of parsed.payload.critical) {
      if (!KNOWN_PAYLOAD_FIELDS.has(field)) {
        throw new Error(`Unknown mandatory field: ${field}`);
      }
    }
  }

  return parsed;
}
