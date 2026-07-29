/**
 * Central cryptographic payload and attachment size limits (#1701).
 *
 * All limits are enforced before expensive operations (key generation, hashing,
 * encryption) so oversized input fails fast. Limits are measured in UTF-8
 * encoded bytes for string fields and raw bytes for binary data.
 *
 * This module is the single source of truth. Consumers should import constants
 * and validators from here rather than scattering magic numbers.
 */

import { CryptoError } from "./errors";
import type { SealEnvelopeInput } from "./envelope";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Maximum message body size in UTF-8 bytes. */
export const MAX_BODY_BYTES = 65_536;

/** Maximum number of attachments per envelope. */
export const MAX_ATTACHMENTS = 16;

/** Maximum per-attachment data size in bytes. */
export const MAX_ATTACHMENT_BYTES = 16_777_216;

/** Maximum filename length in UTF-8 bytes. */
export const MAX_FILENAME_BYTES = 256;

/** Maximum content-type length in UTF-8 bytes. */
export const MAX_CONTENT_TYPE_BYTES = 128;

/** Maximum sender identity length in UTF-8 bytes. */
export const MAX_SENDER_BYTES = 256;

/** Maximum recipient identity length in UTF-8 bytes. */
export const MAX_RECIPIENT_BYTES = 256;

/** Maximum timestamp string length in UTF-8 bytes. */
export const MAX_TIMESTAMP_BYTES = 64;

/** Maximum number of recipient public keys for key wrapping. */
export const MAX_RECIPIENT_KEYS = 100;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isNonEmptyString(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/* ------------------------------------------------------------------ */
/*  Validators                                                         */
/* ------------------------------------------------------------------ */

/**
 * Validate message body size and content.
 * @throws CryptoError if the body is empty, whitespace-only, or exceeds MAX_BODY_BYTES.
 */
export function validateBody(body: string): void {
  if (!isNonEmptyString(body)) {
    throw new CryptoError("crypto_validation_error", "Message body must be non-empty");
  }
  const encodedLength = utf8ByteLength(body);
  if (encodedLength > MAX_BODY_BYTES) {
    throw new CryptoError(
      "crypto_validation_error",
      `Message body exceeds ${MAX_BODY_BYTES} bytes`,
    );
  }
}

/**
 * Validate a single attachment's metadata.
 * @throws CryptoError if filename, content_type, or size_bytes violates limits.
 */
export function validateAttachment(attachment: {
  filename: string;
  content_type: string;
  size_bytes: number;
  data?: ArrayBuffer;
}): void {
  if (!isNonEmptyString(attachment.filename)) {
    throw new CryptoError("crypto_validation_error", "Attachment filename must be non-empty");
  }
  const fnBytes = utf8ByteLength(attachment.filename);
  if (fnBytes > MAX_FILENAME_BYTES) {
    throw new CryptoError(
      "crypto_validation_error",
      `Attachment filename exceeds ${MAX_FILENAME_BYTES} bytes`,
    );
  }

  if (!isNonEmptyString(attachment.content_type)) {
    throw new CryptoError("crypto_validation_error", "Attachment content type must be non-empty");
  }
  const ctBytes = utf8ByteLength(attachment.content_type);
  if (ctBytes > MAX_CONTENT_TYPE_BYTES) {
    throw new CryptoError(
      "crypto_validation_error",
      `Attachment content type exceeds ${MAX_CONTENT_TYPE_BYTES} bytes`,
    );
  }

  if (attachment.size_bytes > MAX_ATTACHMENT_BYTES) {
    throw new CryptoError(
      "crypto_validation_error",
      `Attachment data exceeds ${MAX_ATTACHMENT_BYTES} bytes`,
    );
  }

  if (attachment.data && attachment.data.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new CryptoError(
      "crypto_validation_error",
      `Attachment data exceeds ${MAX_ATTACHMENT_BYTES} bytes`,
    );
  }
}

/**
 * Validate the full attachments array.
 * @throws CryptoError if the count exceeds MAX_ATTACHMENTS or any individual attachment is invalid.
 */
export function validateAttachments(attachments: SealEnvelopeInput["attachments"]): void {
  if (!attachments || attachments.length === 0) return;

  if (attachments.length > MAX_ATTACHMENTS) {
    throw new CryptoError(
      "crypto_validation_error",
      `Number of attachments exceeds ${MAX_ATTACHMENTS}`,
    );
  }

  for (const attachment of attachments) {
    validateAttachment(attachment);
  }
}

/**
 * Validate the entire SealEnvelopeInput before expensive crypto operations.
 *
 * Checks body, attachments, sender/recipient identity length, and recipient
 * key count. Throws CryptoError("crypto_validation_error") on the first
 * violation.
 *
 * This is called at the top of sealEnvelope before any key generation,
 * hashing, or encryption.
 */
export function validateEnvelopeInput(input: SealEnvelopeInput): void {
  validateBody(input.body);

  if (!isNonEmptyString(input.sender)) {
    throw new CryptoError("crypto_validation_error", "Sender must be non-empty");
  }
  if (utf8ByteLength(input.sender) > MAX_SENDER_BYTES) {
    throw new CryptoError(
      "crypto_validation_error",
      `Sender identity exceeds ${MAX_SENDER_BYTES} bytes`,
    );
  }

  if (!isNonEmptyString(input.recipient)) {
    throw new CryptoError("crypto_validation_error", "Recipient must be non-empty");
  }
  if (utf8ByteLength(input.recipient) > MAX_RECIPIENT_BYTES) {
    throw new CryptoError(
      "crypto_validation_error",
      `Recipient identity exceeds ${MAX_RECIPIENT_BYTES} bytes`,
    );
  }

  validateAttachments(input.attachments);

  if (input.recipientPublicKeys && input.recipientPublicKeys.length > MAX_RECIPIENT_KEYS) {
    throw new CryptoError(
      "crypto_validation_error",
      `Number of recipient keys exceeds ${MAX_RECIPIENT_KEYS}`,
    );
  }
}
