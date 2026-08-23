/**
 * Attachment upload session management (BETA-031 / #1938).
 *
 * Manages the lifecycle of a resumable encrypted attachment upload:
 * initiate -> chunk upload(s) -> finalize (or abort).
 *
 * Each session tracks which chunks have been staged so interrupted uploads
 * can resume without duplicating committed chunks. Sessions expire after a
 * configurable TTL and are cleaned up by an orphan sweep.
 *
 * Content-addressed chunk keys ensure that re-uploading the same encrypted
 * chunk is idempotent — the storage layer overwrites the same key.
 */

import { createObjectCommitment } from "@/services/storage/object-store";

export const DEFAULT_UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const MAX_ATTACHMENTS_PER_SESSION = 16;
export const MAX_SESSION_ID_LENGTH = 128;

export type UploadSessionStatus = "pending" | "uploading" | "finalized" | "aborted";

export interface UploadAttachmentSession {
  attachmentIndex: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
  contentHash: string;
  totalChunks: number;
  uploadedChunks: Set<number>;
  chunkCommitments: Map<number, string>;
}

export interface UploadSession {
  sessionId: string;
  ownerAddress: string;
  messageId: string;
  attachments: UploadAttachmentSession[];
  status: UploadSessionStatus;
  createdAt: string;
  expiresAt: string;
}

export class UploadSessionError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "UploadSessionError";
    this.code = code;
    this.status = status;
  }
}

const sessions = new Map<string, UploadSession>();

function generateSessionId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isExpired(session: UploadSession, now: Date): boolean {
  return new Date(session.expiresAt).getTime() <= now.getTime();
}

export function getUploadSession(sessionId: string): UploadSession | undefined {
  const session = sessions.get(sessionId);
  if (session && isExpired(session, new Date())) {
    sessions.delete(sessionId);
    return undefined;
  }
  return session;
}

export function cleanupExpiredSessions(now: Date = new Date()): number {
  let count = 0;
  for (const [id, session] of sessions) {
    if (isExpired(session, now)) {
      sessions.delete(id);
      count++;
    }
  }
  return count;
}

export interface InitiateUploadInput {
  ownerAddress: string;
  messageId: string;
  attachments: Array<{
    filename: string;
    content_type: string;
    size_bytes: number;
    content_hash: string;
    total_chunks: number;
  }>;
  ttlMs?: number;
}

export interface InitiateUploadResult {
  session_id: string;
  attachments: Array<{
    attachment_index: number;
    total_chunks: number;
    uploaded_chunks: number[];
  }>;
  expires_at: string;
}

export function initiateUploadSession(input: InitiateUploadInput): InitiateUploadResult {
  if (input.attachments.length === 0) {
    throw new UploadSessionError("bad_request", "At least one attachment is required", 400);
  }
  if (input.attachments.length > MAX_ATTACHMENTS_PER_SESSION) {
    throw new UploadSessionError(
      "bad_request",
      `Too many attachments: maximum ${MAX_ATTACHMENTS_PER_SESSION}`,
      400,
    );
  }

  const now = new Date();
  const ttlMs = input.ttlMs ?? DEFAULT_UPLOAD_SESSION_TTL_MS;
  const sessionId = generateSessionId();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

  const attachments: UploadAttachmentSession[] = input.attachments.map((att, index) => ({
    attachmentIndex: index,
    filename: att.filename,
    contentType: att.content_type,
    sizeBytes: att.size_bytes,
    contentHash: att.content_hash,
    totalChunks: att.total_chunks,
    uploadedChunks: new Set<number>(),
    chunkCommitments: new Map<number, string>(),
  }));

  const session: UploadSession = {
    sessionId,
    ownerAddress: input.ownerAddress,
    messageId: input.messageId,
    attachments,
    status: "uploading",
    createdAt: now.toISOString(),
    expiresAt,
  };

  sessions.set(sessionId, session);

  return {
    session_id: sessionId,
    attachments: attachments.map((att) => ({
      attachment_index: att.attachmentIndex,
      total_chunks: att.totalChunks,
      uploaded_chunks: [],
    })),
    expires_at: expiresAt,
  };
}

export interface UploadChunkInput {
  sessionId: string;
  ownerAddress: string;
  attachmentIndex: number;
  chunkIndex: number;
  chunkBytes: Uint8Array;
}

export interface UploadChunkResult {
  session_id: string;
  attachment_index: number;
  chunk_index: number;
  content_commitment: string;
  already_uploaded: boolean;
}

export async function uploadChunk(input: UploadChunkInput): Promise<UploadChunkResult> {
  const session = getUploadSession(input.sessionId);
  if (!session) {
    throw new UploadSessionError("not_found", "Upload session not found or expired", 404);
  }
  if (session.ownerAddress !== input.ownerAddress) {
    throw new UploadSessionError("forbidden", "Not authorized to modify this upload session", 403);
  }
  if (session.status !== "uploading") {
    throw new UploadSessionError(
      "invalid_state_transition",
      `Cannot upload chunks in ${session.status} status`,
      409,
    );
  }

  const attachment = session.attachments[input.attachmentIndex];
  if (!attachment) {
    throw new UploadSessionError(
      "bad_request",
      `Invalid attachment index: ${input.attachmentIndex}`,
      400,
    );
  }
  if (input.chunkIndex < 0 || input.chunkIndex >= attachment.totalChunks) {
    throw new UploadSessionError(
      "bad_request",
      `Chunk index ${input.chunkIndex} out of range [0, ${attachment.totalChunks})`,
      400,
    );
  }

  const contentCommitment = await createObjectCommitment(
    input.chunkBytes instanceof Uint8Array ? input.chunkBytes : new Uint8Array(input.chunkBytes),
  );

  const alreadyUploaded = attachment.uploadedChunks.has(input.chunkIndex);
  attachment.uploadedChunks.add(input.chunkIndex);
  attachment.chunkCommitments.set(input.chunkIndex, contentCommitment);

  return {
    session_id: input.sessionId,
    attachment_index: input.attachmentIndex,
    chunk_index: input.chunkIndex,
    content_commitment: contentCommitment,
    already_uploaded: alreadyUploaded,
  };
}

export interface FinalizeUploadInput {
  sessionId: string;
  ownerAddress: string;
}

export interface FinalizeUploadResult {
  session_id: string;
  message_id: string;
  attachments: Array<{
    attachment_index: number;
    filename: string;
    content_type: string;
    size_bytes: number;
    content_hash: string;
    total_chunks: number;
    chunks_uploaded: number;
    all_chunks_complete: boolean;
  }>;
  status: "finalized" | "partial";
}

export function finalizeUploadSession(input: FinalizeUploadInput): FinalizeUploadResult {
  const session = getUploadSession(input.sessionId);
  if (!session) {
    throw new UploadSessionError("not_found", "Upload session not found or expired", 404);
  }
  if (session.ownerAddress !== input.ownerAddress) {
    throw new UploadSessionError(
      "forbidden",
      "Not authorized to finalize this upload session",
      403,
    );
  }
  if (session.status !== "uploading") {
    throw new UploadSessionError(
      "invalid_state_transition",
      `Cannot finalize in ${session.status} status`,
      409,
    );
  }

  const allComplete = session.attachments.every(
    (att) => att.uploadedChunks.size === att.totalChunks,
  );

  session.status = allComplete ? "finalized" : "uploading";

  return {
    session_id: input.sessionId,
    message_id: session.messageId,
    attachments: session.attachments.map((att) => ({
      attachment_index: att.attachmentIndex,
      filename: att.filename,
      content_type: att.contentType,
      size_bytes: att.sizeBytes,
      content_hash: att.contentHash,
      total_chunks: att.totalChunks,
      chunks_uploaded: att.uploadedChunks.size,
      all_chunks_complete: att.uploadedChunks.size === att.totalChunks,
    })),
    status: allComplete ? "finalized" : "partial",
  };
}

export interface AbortUploadInput {
  sessionId: string;
  ownerAddress: string;
}

export function abortUploadSession(input: AbortUploadInput): {
  session_id: string;
  aborted: boolean;
} {
  const session = getUploadSession(input.sessionId);
  if (!session) {
    throw new UploadSessionError("not_found", "Upload session not found or expired", 404);
  }
  if (session.ownerAddress !== input.ownerAddress) {
    throw new UploadSessionError("forbidden", "Not authorized to abort this upload session", 403);
  }

  const wasActive = session.status === "uploading";
  session.status = "aborted";
  sessions.delete(input.sessionId);

  return { session_id: input.sessionId, aborted: wasActive };
}

export interface GetSessionProgressInput {
  sessionId: string;
  ownerAddress: string;
}

export interface SessionProgressResult {
  session_id: string;
  status: UploadSessionStatus;
  message_id: string;
  attachments: Array<{
    attachment_index: number;
    total_chunks: number;
    uploaded_chunks: number[];
  }>;
}

export function getUploadSessionProgress(input: GetSessionProgressInput): SessionProgressResult {
  const session = getUploadSession(input.sessionId);
  if (!session) {
    throw new UploadSessionError("not_found", "Upload session not found or expired", 404);
  }
  if (session.ownerAddress !== input.ownerAddress) {
    throw new UploadSessionError("forbidden", "Not authorized to view this upload session", 403);
  }

  return {
    session_id: input.sessionId,
    status: session.status,
    message_id: session.messageId,
    attachments: session.attachments.map((att) => ({
      attachment_index: att.attachmentIndex,
      total_chunks: att.totalChunks,
      uploaded_chunks: Array.from(att.uploadedChunks).sort((a, b) => a - b),
    })),
  };
}
