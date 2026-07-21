const MAX_RAW_PAYLOAD_BYTES = 30 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_MULTIPART_PARTS = 250;
const MAX_BOUNDARY_LENGTH = 200;
const MAX_FILENAME_LENGTH = 180;

const SAFE_BOUNDARY = /^[A-Za-z0-9'()+_,./:=?-]{1,200}$/;
const HEADER_SEPARATOR = /\r?\n\r?\n/;

export interface AttachmentMetadata {
  id: string;
  /** Sanitized filename of the attachment. */
  filename: string;
  contentType: string;
  size: number;
}

export interface ExtractionResult {
  success: boolean;
  attachments: AttachmentMetadata[];
  error?: string;
  warnings?: string[];
}

export interface RawExtractionOptions {
  maxPayloadBytes?: number;
  maxAttachmentBytes?: number;
  maxParts?: number;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeAttachmentFilename(filename: string): string {
  const lastSegment = filename.replace(/\\/g, "/").split("/").pop() || "attachment";
  // eslint-disable-next-line no-control-regex
  const withoutControls = lastSegment.replace(/[\u0000-\u001f\u007f]/g, "");
  const sanitized = withoutControls.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return (sanitized || "attachment").slice(0, MAX_FILENAME_LENGTH);
}

function extractHeaderValue(headers: string, name: string): string | undefined {
  const unfolded = headers.replace(/\r?\n[\t ]+/g, " ");
  const match = unfolded.match(new RegExp(`^${name}:\\s*([^\\r\\n]+)`, "im"));
  return match?.[1]?.trim();
}

function extractParameter(header: string | undefined, parameter: string): string | undefined {
  if (!header) return undefined;
  const quoted = header.match(
    new RegExp(
      `${parameter}\\*=\\s*([^;]+)|${parameter}=\\s*"([^"]*)"|${parameter}=\\s*([^;]+)`,
      "i",
    ),
  );
  const rawValue = quoted?.[1] || quoted?.[2] || quoted?.[3];
  if (!rawValue) return undefined;

  // Decode the common RFC 5987 form: filename*=UTF-8''report.txt. Unsupported charsets are left encoded.
  const rfc5987 = rawValue.match(/^utf-8''(.+)$/i);
  if (rfc5987) {
    try {
      return decodeURIComponent(rfc5987[1]);
    } catch {
      return rfc5987[1];
    }
  }

  return rawValue.trim();
}

function parseBoundary(rawPayload: string): string | undefined {
  const contentType = extractHeaderValue(rawPayload.slice(0, 8192), "Content-Type");
  const boundary = extractParameter(contentType, "boundary");
  if (!boundary || boundary.length > MAX_BOUNDARY_LENGTH || !SAFE_BOUNDARY.test(boundary)) {
    return undefined;
  }
  return boundary;
}

/**
 * Core behavior for extracting attachment metadata from a raw mail payload.
 * Hostile payloads are bounded by payload size, boundary validation, part count,
 * filename sanitization, and per-attachment size limits before metadata is returned.
 *
 * @param rawPayload - The raw, isolated email payload string.
 */
export async function extractAttachments(
  rawPayload: string,
  options: RawExtractionOptions = {},
): Promise<ExtractionResult> {
  const maxPayloadBytes = options.maxPayloadBytes ?? MAX_RAW_PAYLOAD_BYTES;
  const maxAttachmentBytes = options.maxAttachmentBytes ?? MAX_ATTACHMENT_BYTES;
  const maxParts = options.maxParts ?? MAX_MULTIPART_PARTS;
  const warnings: string[] = [];

  try {
    if (typeof rawPayload !== "string") {
      return { success: false, attachments: [], error: "Raw payload must be a string." };
    }

    if (byteLength(rawPayload) > maxPayloadBytes) {
      return {
        success: false,
        attachments: [],
        error: "Raw payload exceeds the safe parsing limit.",
      };
    }

    const boundary = parseBoundary(rawPayload);
    if (!boundary) {
      return { success: true, attachments: [], warnings: ["No safe multipart boundary found."] };
    }

    const delimiter = new RegExp(
      `(?:^|\\r?\\n)--${escapeRegExp(boundary)}(?:--)?(?:\\r?\\n|$)`,
      "g",
    );
    const parts = rawPayload.split(delimiter);

    if (parts.length > maxParts) {
      return {
        success: false,
        attachments: [],
        error: "Multipart payload contains too many parts.",
      };
    }

    const attachments: AttachmentMetadata[] = [];

    for (const part of parts) {
      const separatorMatch = part.match(HEADER_SEPARATOR);
      if (!separatorMatch || separatorMatch.index === undefined) continue;

      const headers = part.slice(0, separatorMatch.index);
      const body = part.slice(separatorMatch.index + separatorMatch[0].length);
      const disposition = extractHeaderValue(headers, "Content-Disposition");
      if (!/\battachment\b/i.test(disposition || "")) continue;

      const contentType = extractHeaderValue(headers, "Content-Type") || "application/octet-stream";
      const filename = sanitizeAttachmentFilename(
        extractParameter(disposition, "filename") ||
          extractParameter(contentType, "name") ||
          "attachment",
      );
      const size = byteLength(body);

      if (size > maxAttachmentBytes) {
        warnings.push(`Skipped ${filename}: attachment exceeds the safe size limit.`);
        continue;
      }

      attachments.push({
        id: `${filename}-${attachments.length + 1}`,
        filename,
        contentType,
        size,
      });
    }

    return { success: true, attachments, warnings };
  } catch (e) {
    const error = e instanceof Error ? e.message : "An unknown error occurred during parsing.";
    return { success: false, attachments: [], error };
  }
}
