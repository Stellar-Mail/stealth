/**
 * Attachment upload client service (BETA-031 / #1938).
 *
 * Provides a resumable, encrypted attachment upload with progress tracking,
 * retry with exponential backoff, and cancellation via AbortController.
 *
 * The service encrypts each chunk client-side using the existing
 * `encryptAttachmentStream` primitives, then uploads encrypted chunks to the
 * relay API. Interrupted uploads resume by querying the session for which
 * chunks were already committed.
 */

import {
  encryptAttachmentStream,
  generateAttachmentKey,
  DEFAULT_CHUNK_SIZE_BYTES,
  type EncryptedChunkFrame,
  type AttachmentStreamManifest,
} from "@/services/crypto/attachment-stream";

export interface AttachmentUploadDescriptor {
  filename: string;
  contentType: string;
  sizeBytes: number;
  contentHash: string;
}

export interface UploadSession {
  sessionId: string;
  attachments: Array<{
    attachmentIndex: number;
    totalChunks: number;
    uploadedChunks: number[];
  }>;
  expiresAt: string;
}

export interface UploadProgress {
  attachmentIndex: number;
  chunkIndex: number;
  totalChunks: number;
  uploadedChunks: number;
  percent: number;
}

export type UploadStatus =
  | "idle"
  | "encrypting"
  | "uploading"
  | "finalizing"
  | "done"
  | "error"
  | "cancelled";

export class AttachmentUploadError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "AttachmentUploadError";
    this.code = code;
    this.retryable = retryable;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new AttachmentUploadError("cancelled", "Upload was cancelled");
    }
    try {
      const response = await fetch(url, { ...init, signal });
      if (response.ok) return response;

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 1000 * 2 ** attempt;
        await delay(waitMs);
        continue;
      }

      if (response.status >= 500 && attempt < maxRetries) {
        await delay(1000 * 2 ** attempt);
        continue;
      }

      const body = await response.json().catch(() => null);
      const message = body?.error?.message ?? `HTTP ${response.status}`;
      throw new AttachmentUploadError("server_error", message);
    } catch (error) {
      if (error instanceof AttachmentUploadError) throw error;
      if (signal?.aborted) {
        throw new AttachmentUploadError("cancelled", "Upload was cancelled");
      }
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await delay(1000 * 2 ** attempt);
      }
    }
  }
  throw new AttachmentUploadError(
    "network_error",
    lastError?.message ?? "Upload failed after retries",
    true,
  );
}

export interface UploadFileInput {
  file: File;
  ownerAddress: string;
  messageId: string;
  chunkSizeBytes?: number;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  onStatusChange?: (status: UploadStatus) => void;
  baseUrl?: string;
}

export interface UploadFileResult {
  sessionId: string;
  manifest: AttachmentStreamManifest;
  totalChunks: number;
}

export async function uploadAttachment(input: UploadFileInput): Promise<UploadFileResult> {
  const {
    file,
    ownerAddress,
    messageId,
    chunkSizeBytes = DEFAULT_CHUNK_SIZE_BYTES,
    signal,
    onProgress,
    onStatusChange,
    baseUrl = "/api/v1/attachments",
  } = input;

  onStatusChange?.("encrypting");

  const key = await generateAttachmentKey();
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));

  const totalChunks = Math.ceil(file.size / chunkSizeBytes);
  const contentHash = await computeFileHash(file);

  const initiateResponse = await fetchWithRetry(
    `${baseUrl}/initiate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: messageId,
        attachments: [
          {
            filename: file.name,
            content_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            content_hash: contentHash,
            total_chunks: totalChunks,
          },
        ],
      }),
    },
    signal,
  );

  const initiateData = await initiateResponse.json();
  const session: UploadSession = initiateData.data;

  const alreadyUploaded = new Set(session.attachments[0]?.uploadedChunks ?? []);

  onStatusChange?.("uploading");

  const source = file.stream();
  const encrypted = encryptAttachmentStream(key, source, { chunkSizeBytes });
  const frames: EncryptedChunkFrame[] = [];

  let uploadedCount = alreadyUploaded.size;
  let chunkIndex = 0;

  for await (const frame of encrypted.chunks) {
    if (signal?.aborted) {
      throw new AttachmentUploadError("cancelled", "Upload was cancelled");
    }

    frames.push(frame);

    if (!alreadyUploaded.has(chunkIndex)) {
      await fetchWithRetry(
        `${baseUrl}/chunk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: session.sessionId,
            attachment_index: 0,
            chunk_index: chunkIndex,
            nonce: frame.nonce,
            ciphertext: frame.ciphertext,
            mac: frame.mac,
            final: frame.final,
          }),
        },
        signal,
      );

      uploadedCount++;
    }

    onProgress?.({
      attachmentIndex: 0,
      chunkIndex,
      totalChunks,
      uploadedChunks: uploadedCount,
      percent: Math.round(((chunkIndex + 1) / totalChunks) * 100),
    });

    chunkIndex++;
  }

  const manifest = await encrypted.manifest;

  onStatusChange?.("finalizing");

  await fetchWithRetry(
    `${baseUrl}/finalize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.sessionId }),
    },
    signal,
  );

  onStatusChange?.("done");

  return { sessionId: session.sessionId, manifest, totalChunks };
}

export async function abortUpload(
  sessionId: string,
  baseUrl = "/api/v1/attachments",
): Promise<void> {
  await fetch(`${baseUrl}/abort`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  }).catch(() => undefined);
}

async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
