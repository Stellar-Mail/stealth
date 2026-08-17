/**
 * Attachment Crypto Streaming & Hashing Helpers
 *
 * Implements chunk hashing, attachment commitment calculation,
 * AES-256-GCM chunk encryption/decryption, and safe metadata sanitization.
 */

export interface AttachmentMetadata {
  filename: string;
  contentType: string;
  size: number;
}

/**
 * Sanitizes attachment filenames against path traversal, control characters,
 * null bytes, and embedded XSS script tags.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") {
    return "unnamed_attachment";
  }

  let name = filename;

  // Remove path components (Unix or Windows directory traversal)
  const lastWinDir = name.lastIndexOf("\\");
  const lastUnixDir = name.lastIndexOf("/");

  if (lastWinDir !== -1 && lastWinDir > lastUnixDir) {
    name = name.slice(lastWinDir + 1);
  } else if (lastUnixDir !== -1) {
    // Only strip slash as dir separator if not part of an HTML end tag like </script>
    const isHtmlEndTag = /<\/[a-zA-Z]/.test(name.slice(Math.max(0, lastUnixDir - 1)));
    if (!isHtmlEndTag) {
      name = name.slice(lastUnixDir + 1);
    }
  }

  // Strip null bytes and control characters (ASCII 0-31 and 127)
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\x00-\x1F\x7F]/g, "");

  // Strip HTML / XSS tags
  name = name.replace(/<[^>]*>/g, "");

  // Trim whitespace
  name = name.trim();

  // If empty after sanitization, fallback to default
  if (!name || name === "." || name === "..") {
    return "unnamed_attachment";
  }

  // Limit filename length to 255 chars
  if (name.length > 255) {
    const extIndex = name.lastIndexOf(".");
    if (extIndex > 0 && extIndex > name.length - 20) {
      const ext = name.slice(extIndex);
      name = name.slice(0, 255 - ext.length) + ext;
    } else {
      name = name.slice(0, 255);
    }
  }

  return name;
}

/**
 * Dangerous MIME types that can lead to script execution if rendered inline.
 */
const DANGEROUS_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "text/ecmascript",
  "application/ecmascript",
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
  "application/x-bat",
  "application/x-cmd",
  "application/vnd.microsoft.portable-executable",
]);

/**
 * Normalizes and sanitizes content types to prevent XSS / script injection attacks.
 */
export function sanitizeContentType(contentType: string, filename: string): string {
  if (!contentType || typeof contentType !== "string") {
    contentType = "application/octet-stream";
  }

  const mime = contentType.split(";")[0].trim().toLowerCase();

  // Check dangerous types
  if (DANGEROUS_MIME_TYPES.has(mime)) {
    return "application/octet-stream";
  }

  // Deduce type from filename extension if octet-stream
  if (mime === "application/octet-stream" && filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext) {
      switch (ext) {
        case "pdf":
          return "application/pdf";
        case "png":
          return "image/png";
        case "jpg":
        case "jpeg":
          return "image/jpeg";
        case "webp":
          return "image/webp";
        case "gif":
          return "image/gif";
        case "json":
          return "application/json";
        case "txt":
        case "log":
        case "md":
          return "text/plain";
      }
    }
  }

  return mime || "application/octet-stream";
}

/**
 * Computes a SHA-256 hex hash of a binary chunk using Web Crypto API.
 */
export async function computeChunkHash(chunk: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", chunk);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes an overall attachment commitment hash derived from chunk hashes & metadata.
 */
export async function computeAttachmentCommitment(
  chunkHashes: string[],
  metadata: AttachmentMetadata,
): Promise<string> {
  const encoder = new TextEncoder();
  const canonicalString = JSON.stringify({
    chunkHashes,
    contentType: sanitizeContentType(metadata.contentType, metadata.filename),
    filename: sanitizeFilename(metadata.filename),
    size: metadata.size,
  });

  const buffer = encoder.encode(canonicalString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates an AES-256-GCM symmetric key for attachment encryption.
 */
export async function generateAttachmentKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Exports a CryptoKey to raw hex string.
 */
export async function exportKeyHex(key: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const byteArray = Array.from(new Uint8Array(rawKey));
  return byteArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Imports a CryptoKey from raw hex string.
 */
export async function importKeyHex(hex: string): Promise<CryptoKey> {
  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [],
  );
  return await crypto.subtle.importKey("raw", bytes, { name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypts a binary chunk using AES-GCM with a specific IV.
 */
export async function encryptChunk(
  chunk: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<Uint8Array> {
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    chunk,
  );
  return new Uint8Array(encryptedBuffer);
}

/**
 * Decrypts an encrypted binary chunk using AES-GCM with a specific IV.
 */
export async function decryptChunk(
  encryptedChunk: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<Uint8Array> {
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encryptedChunk,
  );
  return new Uint8Array(decryptedBuffer);
}
