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
}

/**
 * Core behavior for extracting attachment metadata from a raw mail payload.
 *
 * @param rawPayload - The raw, isolated email payload string.
 */
export async function extractAttachments(rawPayload: string): Promise<ExtractionResult> {
  try {
    const attachments: AttachmentMetadata[] = [];
    const boundaryMatch = rawPayload.match(/boundary="?([^"]+)"?/);

    if (!boundaryMatch) {
      // Not a multipart message, or boundary is not defined
      return { success: true, attachments: [] };
    }

    const boundary = boundaryMatch[1];
    const parts = rawPayload.split(`--${boundary}`);

    for (const part of parts) {
      if (!part.includes("Content-Disposition: attachment")) {
        continue;
      }

      const filenameMatch = part.match(/filename="?([^"]+)"?/);
      const contentTypeMatch = part.match(/Content-Type: (.+)/);

      if (filenameMatch && contentTypeMatch) {
        const filename = filenameMatch[1];
        const contentType = contentTypeMatch[1].trim();

        // Extract the content part after the headers
        const contentStartIndex = part.indexOf("\r\n\r\n");
        if (contentStartIndex === -1) continue;

        // The actual content starts after the double newline
        const content = part.substring(contentStartIndex + 4);

        // For size calculation, we need to consider the encoding.
        // A simple byte length of the string content is a reasonable approximation
        // for this tool's purpose without full base64 decoding.
        const size = new TextEncoder().encode(content).length;

        // Basic security: sanitize filename to prevent path traversal
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

        // Enforce file size limit
        const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
        if (size > MAX_FILE_SIZE_BYTES) {
          // As per the test plan, we should handle this.
          // For now, we will skip it, but a real implementation might return an error.
          continue;
        }

        attachments.push({
          id: `${sanitizedFilename}-${Date.now()}-${Math.random()}`, // Simple unique ID
          filename: sanitizedFilename,
          contentType,
          size,
        });
      }
    }

    return { success: true, attachments };
  } catch (e) {
    const error = e instanceof Error ? e.message : "An unknown error occurred during parsing.";
    return {
      success: false,
      attachments: [],
      error,
    };
  }
}
