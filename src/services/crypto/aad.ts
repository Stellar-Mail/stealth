/**
 * Authenticated additional data for envelope routing metadata (#1687).
 *
 * The AES-GCM AEAD operation in sealEnvelope currently authenticates only
 * attachment descriptors. Sender, recipient, version, and timestamp are NOT
 * bound to the ciphertext and can be altered independently without triggering
 * decryption failure.
 *
 * This module defines a canonical protected-header structure that includes
 * ALL routing metadata. It is used as the AAD (additional authenticated data)
 * during both sealing and opening, so any mutation of a protected field causes
 * AES-GCM tag verification to fail.
 *
 * Encoding uses JCS (RFC 8785) via the existing canonicalize() helper for
 * deterministic byte output.
 */

import { canonicalize } from "./jcs";
import type { AttachmentDescriptor } from "./attachment-metadata";

/**
 * Protected header fields authenticated by the AEAD operation.
 * Every field here is bound to the ciphertext — tampering with any
 * of them causes decryption to fail.
 */
export interface ProtectedHeader {
  /** Envelope protocol version, e.g. "v1". */
  version: string;
  /** Sender's Stellar account address or identity. */
  sender: string;
  /** Recipient's Stellar account address or identity. */
  recipient: string;
  /** ISO 8601 timestamp of when the envelope was sealed. */
  timestamp: string;
  /**
   * Authenticated attachment descriptors.
   * Empty array when there are no attachments.
   */
  attachments: AttachmentDescriptor[];
}

/**
 * Encode the protected header as JCS-canonicalized UTF-8 bytes suitable
 * for use as AES-GCM additional authenticated data.
 *
 * The output is deterministic: the same header always produces the same
 * byte sequence (guaranteed by JCS RFC 8785).
 */
export function encodeAad(header: ProtectedHeader): Uint8Array {
  const canonicalString = canonicalize({
    version: header.version,
    sender: header.sender,
    recipient: header.recipient,
    timestamp: header.timestamp,
    attachments: header.attachments.map((a) => ({
      filename: a.filename,
      content_type: a.content_type,
      size_bytes: a.size_bytes,
      content_hash: a.content_hash,
    })),
  });
  return new TextEncoder().encode(canonicalString);
}
