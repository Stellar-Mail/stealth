import { canonicalize } from "./jcs";

export interface AttachmentDescriptor {
  filename: string;
  content_type: string;
  size_bytes: number;
  content_hash: string;
}

/**
 * Canonicalizes attachment descriptors for additional authenticated data (AAD).
 * Uses RFC 8785 JSON Canonicalization Scheme (JCS) under the hood.
 * Authenticates filename, MIME type, size, ordering, and content commitment.
 */
export function canonicalizeAttachmentDescriptors(attachments: AttachmentDescriptor[]): Uint8Array {
  const normalized = attachments.map((a) => ({
    filename: a.filename,
    content_type: a.content_type,
    size_bytes: a.size_bytes,
    content_hash: a.content_hash,
  }));
  const canonicalString = canonicalize(normalized);
  return new TextEncoder().encode(canonicalString);
}

/**
 * Safe filename normalization for display purposes.
 * Strips directory traversal segments and unsafe characters.
 * This is handled before display, not inside the cryptographic identity.
 */
export function sanitizeFilenameForDisplay(filename: string): string {
  // Replace backslashes with forward slashes
  let safe = filename.replace(/\\/g, "/");

  // Remove directory traversal sequences (../ or ./)
  safe = safe.replace(/(?:\.\.\/|\.\/)/g, "");

  // Strip leading slashes
  safe = safe.replace(/^\/+/, "");

  // Extract the base filename segment
  const lastSegment = safe.split("/").pop();
  return lastSegment || "unnamed_attachment";
}
