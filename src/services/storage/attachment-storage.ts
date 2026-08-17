import { ApiError, type ApiErrorCode } from "@/server/api/errors";
import {
  computeAttachmentCommitment,
  computeChunkHash,
  sanitizeContentType,
  sanitizeFilename,
} from "../crypto/attachment-stream";

function mapStatusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "validation_error";
    case 429:
      return "too_many_requests";
    default:
      return status >= 500 ? "internal_error" : "bad_request";
  }
}

export class AttachmentStorageError extends ApiError {
  constructor(message: string, statusCode: number = 400, _storageCode?: string) {
    super(statusCode, mapStatusToCode(statusCode), message);
    this.name = "AttachmentStorageError";
  }
}

export class AttachmentStorageService {
  private sessions = new Map<string, AttachmentDescriptor>();
  private chunks = new Map<string, Uint8Array>(); // key: `${attachmentId}:${chunkIndex}`
  private chunkHashes = new Map<string, string>(); // key: `${attachmentId}:${chunkIndex}`

  /**
   * Initiates an attachment upload session.
   */
  async initiateSession(params: InitiateUploadParams): Promise<AttachmentDescriptor> {
    if (!params.sender || !params.recipient) {
      throw new AttachmentStorageError(
        "Sender and recipient are required",
        400,
        "INVALID_PARTICIPANTS",
      );
    }

    if (params.size <= 0) {
      throw new AttachmentStorageError(
        "Attachment size must be greater than zero",
        400,
        "INVALID_SIZE",
      );
    }

    if (params.chunkCount <= 0) {
      throw new AttachmentStorageError(
        "Chunk count must be greater than zero",
        400,
        "INVALID_CHUNK_COUNT",
      );
    }

    const attachmentId =
      params.attachmentId || `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Check for existing session
    const existing = this.sessions.get(attachmentId);
    if (existing) {
      if (existing.sender !== params.sender) {
        throw new AttachmentStorageError(
          "Attachment session exists with different sender",
          403,
          "SESSION_EXISTS",
        );
      }
      return structuredClone(existing);
    }

    const sanitizedFilename = sanitizeFilename(params.filename);
    const sanitizedType = sanitizeContentType(params.contentType, sanitizedFilename);
    const chunkSize = params.chunkSize || Math.ceil(params.size / params.chunkCount);
    const now = new Date().toISOString();

    const descriptor: AttachmentDescriptor = {
      attachmentId,
      messageId: params.messageId,
      sender: params.sender,
      recipient: params.recipient,
      filename: sanitizedFilename,
      contentType: sanitizedType,
      size: params.size,
      chunkCount: params.chunkCount,
      chunkSize,
      commitment: params.commitment,
      status: "initiating",
      uploadedChunks: [],
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(attachmentId, descriptor);
    return structuredClone(descriptor);
  }

  /**
   * Uploads an encrypted chunk. Ensures idempotency and verifies chunk cryptographic hash.
   */
  async uploadChunk(
    params: ChunkUploadParams,
  ): Promise<{ success: boolean; chunkIndex: number; isDuplicate: boolean }> {
    const session = this.sessions.get(params.attachmentId);
    if (!session) {
      throw new AttachmentStorageError("Attachment session not found", 404, "SESSION_NOT_FOUND");
    }

    // Ownership check: Sender only
    if (session.sender !== params.actorId) {
      throw new AttachmentStorageError(
        "Unauthorized actor for upload session",
        403,
        "UNAUTHORIZED_ACTOR",
      );
    }

    if (session.status === "finalized" || session.status === "aborted") {
      throw new AttachmentStorageError(
        `Cannot upload chunk to ${session.status} session`,
        400,
        "INVALID_SESSION_STATE",
      );
    }

    if (params.chunkIndex < 0 || params.chunkIndex >= session.chunkCount) {
      throw new AttachmentStorageError(
        `Invalid chunk index ${params.chunkIndex}. Expected 0..${session.chunkCount - 1}`,
        400,
        "INVALID_CHUNK_INDEX",
      );
    }

    // Verify chunk integrity
    const computedHash = await computeChunkHash(params.data);
    if (params.chunkHash && computedHash.toLowerCase() !== params.chunkHash.toLowerCase()) {
      throw new AttachmentStorageError("Chunk checksum mismatch", 400, "CORRUPT_CHUNK");
    }

    const chunkKey = `${params.attachmentId}:${params.chunkIndex}`;

    // Idempotency: Check if already committed
    if (session.uploadedChunks.includes(params.chunkIndex)) {
      const existingHash = this.chunkHashes.get(chunkKey);
      if (existingHash === computedHash) {
        return { success: true, chunkIndex: params.chunkIndex, isDuplicate: true };
      }
    }

    // Save chunk data
    this.chunks.set(chunkKey, new Uint8Array(params.data));
    this.chunkHashes.set(chunkKey, computedHash);

    if (!session.uploadedChunks.includes(params.chunkIndex)) {
      session.uploadedChunks.push(params.chunkIndex);
      session.uploadedChunks.sort((a, b) => a - b);
    }

    session.status = "uploading";
    session.updatedAt = new Date().toISOString();

    return { success: true, chunkIndex: params.chunkIndex, isDuplicate: false };
  }

  /**
   * Finalizes upload session after verifying all chunks are uploaded and commitment matches.
   */
  async finalizeSession(
    attachmentId: string,
    actorId: string,
    commitment?: string,
  ): Promise<AttachmentDescriptor> {
    const session = this.sessions.get(attachmentId);
    if (!session) {
      throw new AttachmentStorageError("Attachment session not found", 404, "SESSION_NOT_FOUND");
    }

    if (session.sender !== actorId) {
      throw new AttachmentStorageError(
        "Unauthorized actor for session finalization",
        403,
        "UNAUTHORIZED_ACTOR",
      );
    }

    if (session.status === "finalized") {
      return structuredClone(session);
    }

    if (session.status === "aborted") {
      throw new AttachmentStorageError(
        "Cannot finalize an aborted upload session",
        400,
        "SESSION_ABORTED",
      );
    }

    // Check all chunks uploaded
    if (session.uploadedChunks.length < session.chunkCount) {
      throw new AttachmentStorageError(
        `Missing chunks. Uploaded ${session.uploadedChunks.length} of ${session.chunkCount}`,
        400,
        "INCOMPLETE_CHUNKS",
      );
    }

    // Validate chunk hashes & aggregate commitment
    const hashes: string[] = [];
    for (let i = 0; i < session.chunkCount; i++) {
      const chunkHash = this.chunkHashes.get(`${attachmentId}:${i}`);
      if (!chunkHash) {
        throw new AttachmentStorageError(`Missing chunk hash at index ${i}`, 400, "MISSING_CHUNK");
      }
      hashes.push(chunkHash);
    }

    const computedCommitment = await computeAttachmentCommitment(hashes, {
      filename: session.filename,
      contentType: session.contentType,
      size: session.size,
    });

    const expectedCommitment = commitment || session.commitment;
    if (expectedCommitment && computedCommitment !== expectedCommitment) {
      throw new AttachmentStorageError(
        `Attachment commitment mismatch. Computed: ${computedCommitment}, Expected: ${expectedCommitment}`,
        400,
        "COMMITMENT_MISMATCH",
      );
    }

    session.commitment = computedCommitment;
    session.status = "finalized";
    session.updatedAt = new Date().toISOString();

    return structuredClone(session);
  }

  /**
   * Aborts upload session and purges stored chunk data.
   */
  async abortSession(attachmentId: string, actorId: string): Promise<void> {
    const session = this.sessions.get(attachmentId);
    if (!session) {
      return;
    }

    if (session.sender !== actorId) {
      throw new AttachmentStorageError(
        "Unauthorized actor to abort session",
        403,
        "UNAUTHORIZED_ACTOR",
      );
    }

    session.status = "aborted";
    session.updatedAt = new Date().toISOString();

    // Purge stored chunks
    for (let i = 0; i < session.chunkCount; i++) {
      this.chunks.delete(`${attachmentId}:${i}`);
      this.chunkHashes.delete(`${attachmentId}:${i}`);
    }
    session.uploadedChunks = [];
  }

  /**
   * Retrieves upload session metadata (progress & uploaded chunks).
   */
  async getSession(attachmentId: string, actorId: string): Promise<AttachmentDescriptor> {
    const session = this.sessions.get(attachmentId);
    if (!session) {
      throw new AttachmentStorageError("Attachment session not found", 404, "SESSION_NOT_FOUND");
    }

    // Authorization: sender or recipient
    if (session.sender !== actorId && session.recipient !== actorId) {
      throw new AttachmentStorageError(
        "Recipient or sender ownership required",
        403,
        "FORBIDDEN_ACCESS",
      );
    }

    return structuredClone(session);
  }

  /**
   * Authenticated download of attachment payload. Supports HTTP Range requests.
   */
  async getAttachmentContent(
    attachmentId: string,
    actorId: string,
    range?: AttachmentRangeRequest,
  ): Promise<{
    data: Uint8Array;
    filename: string;
    contentType: string;
    totalSize: number;
    commitment: string;
    contentRange?: string;
  }> {
    const session = this.sessions.get(attachmentId);
    if (!session) {
      throw new AttachmentStorageError("Attachment not found", 404, "NOT_FOUND");
    }

    // Ownership Authorization Check
    if (session.sender !== actorId && session.recipient !== actorId) {
      throw new AttachmentStorageError(
        "Access denied: You do not own this attachment",
        403,
        "FORBIDDEN_ACCESS",
      );
    }

    if (session.status !== "finalized") {
      throw new AttachmentStorageError("Attachment upload is not finalized", 400, "NOT_FINALIZED");
    }

    // Reassemble full file buffer from chunks
    const chunkBuffers: Uint8Array[] = [];
    let totalLength = 0;
    for (let i = 0; i < session.chunkCount; i++) {
      const chunk = this.chunks.get(`${attachmentId}:${i}`);
      if (!chunk) {
        throw new AttachmentStorageError(
          `Missing chunk payload at index ${i}`,
          500,
          "CORRUPT_STORAGE",
        );
      }
      chunkBuffers.push(chunk);
      totalLength += chunk.length;
    }

    const fullBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of chunkBuffers) {
      fullBuffer.set(buf, offset);
      offset += buf.length;
    }

    // Handle Range Requests
    if (range && (range.start !== undefined || range.end !== undefined)) {
      const start = range.start ?? 0;
      const end = range.end !== undefined ? Math.min(range.end, totalLength - 1) : totalLength - 1;

      if (start > end || start >= totalLength) {
        throw new AttachmentStorageError(
          "Requested range not satisfiable",
          416,
          "RANGE_NOT_SATISFIABLE",
        );
      }

      const sliced = fullBuffer.subarray(start, end + 1);
      return {
        data: sliced,
        filename: session.filename,
        contentType: session.contentType,
        totalSize: totalLength,
        commitment: session.commitment,
        contentRange: `bytes ${start}-${end}/${totalLength}`,
      };
    }

    return {
      data: fullBuffer,
      filename: session.filename,
      contentType: session.contentType,
      totalSize: totalLength,
      commitment: session.commitment,
    };
  }

  /**
   * Resets all storage state (useful for tests).
   */
  reset(): void {
    this.sessions.clear();
    this.chunks.clear();
    this.chunkHashes.clear();
  }
}
