import { describe, expect, it, beforeEach } from "vitest";
import {
  initiateUploadSession,
  uploadChunk,
  finalizeUploadSession,
  abortUploadSession,
  getUploadSessionProgress,
  getUploadSession,
  cleanupExpiredSessions,
  UploadSessionError,
  type InitiateUploadInput,
} from "../../../src/services/attachment/upload-session";

const OWNER = "GA7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7G";
const MESSAGE_ID = "b".repeat(64);
const CONTENT_HASH = "a".repeat(64);

function makeInitiateInput(overrides: Partial<InitiateUploadInput> = {}): InitiateUploadInput {
  return {
    ownerAddress: OWNER,
    messageId: MESSAGE_ID,
    attachments: [
      {
        filename: "test.pdf",
        content_type: "application/pdf",
        size_bytes: 1024,
        content_hash: CONTENT_HASH,
        total_chunks: 2,
      },
    ],
    ...overrides,
  };
}

describe("upload-session initiation", () => {
  it("creates a session with correct metadata", () => {
    const result = initiateUploadSession(makeInitiateInput());

    expect(result.session_id).toBeDefined();
    expect(result.session_id.length).toBeGreaterThan(0);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].attachment_index).toBe(0);
    expect(result.attachments[0].total_chunks).toBe(2);
    expect(result.attachments[0].uploaded_chunks).toEqual([]);
    expect(result.expires_at).toBeDefined();
  });

  it("rejects empty attachments array", () => {
    expect(() => initiateUploadSession(makeInitiateInput({ attachments: [] }))).toThrow(
      UploadSessionError,
    );
  });

  it("rejects more than 16 attachments", () => {
    const attachments = Array.from({ length: 17 }, (_, i) => ({
      filename: `file${i}.pdf`,
      content_type: "application/pdf",
      size_bytes: 1024,
      content_hash: CONTENT_HASH,
      total_chunks: 1,
    }));
    expect(() => initiateUploadSession(makeInitiateInput({ attachments }))).toThrow(
      UploadSessionError,
    );
  });

  it("creates a retrievable session", () => {
    const result = initiateUploadSession(makeInitiateInput());
    const session = getUploadSession(result.session_id);
    expect(session).toBeDefined();
    expect(session?.ownerAddress).toBe(OWNER);
    expect(session?.messageId).toBe(MESSAGE_ID);
  });
});

describe("upload-session chunk upload", () => {
  it("records uploaded chunks", async () => {
    const result = initiateUploadSession(makeInitiateInput());
    const chunkResult = await uploadChunk({
      sessionId: result.session_id,
      ownerAddress: OWNER,
      attachmentIndex: 0,
      chunkIndex: 0,
      chunkBytes: new Uint8Array([1, 2, 3, 4]),
    });

    expect(chunkResult.session_id).toBe(result.session_id);
    expect(chunkResult.attachment_index).toBe(0);
    expect(chunkResult.chunk_index).toBe(0);
    expect(chunkResult.content_commitment).toBeDefined();
    expect(chunkResult.already_uploaded).toBe(false);
  });

  it("detects idempotent re-upload", async () => {
    const result = initiateUploadSession(makeInitiateInput());
    const bytes = new Uint8Array([1, 2, 3, 4]);

    await uploadChunk({
      sessionId: result.session_id,
      ownerAddress: OWNER,
      attachmentIndex: 0,
      chunkIndex: 0,
      chunkBytes: bytes,
    });

    const second = await uploadChunk({
      sessionId: result.session_id,
      ownerAddress: OWNER,
      attachmentIndex: 0,
      chunkIndex: 0,
      chunkBytes: bytes,
    });

    expect(second.already_uploaded).toBe(true);
  });

  it("rejects chunks for non-existent session", async () => {
    await expect(
      uploadChunk({
        sessionId: "nonexistent",
        ownerAddress: OWNER,
        attachmentIndex: 0,
        chunkIndex: 0,
        chunkBytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow(UploadSessionError);
  });

  it("rejects chunks from wrong owner", async () => {
    const result = initiateUploadSession(makeInitiateInput());
    await expect(
      uploadChunk({
        sessionId: result.session_id,
        ownerAddress: "GZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
        attachmentIndex: 0,
        chunkIndex: 0,
        chunkBytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow(UploadSessionError);
  });

  it("rejects out-of-range chunk index", async () => {
    const result = initiateUploadSession(makeInitiateInput());
    await expect(
      uploadChunk({
        sessionId: result.session_id,
        ownerAddress: OWNER,
        attachmentIndex: 0,
        chunkIndex: 5,
        chunkBytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow(UploadSessionError);
  });

  it("rejects invalid attachment index", async () => {
    const result = initiateUploadSession(makeInitiateInput());
    await expect(
      uploadChunk({
        sessionId: result.session_id,
        ownerAddress: OWNER,
        attachmentIndex: 99,
        chunkIndex: 0,
        chunkBytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow(UploadSessionError);
  });
});

describe("upload-session finalize", () => {
  it("finalizes when all chunks uploaded", async () => {
    const result = initiateUploadSession(makeInitiateInput());

    await uploadChunk({
      sessionId: result.session_id,
      ownerAddress: OWNER,
      attachmentIndex: 0,
      chunkIndex: 0,
      chunkBytes: new Uint8Array([1, 2]),
    });
    await uploadChunk({
      sessionId: result.session_id,
      ownerAddress: OWNER,
      attachmentIndex: 0,
      chunkIndex: 1,
      chunkBytes: new Uint8Array([3, 4]),
    });

    const finalized = finalizeUploadSession({
      sessionId: result.session_id,
      ownerAddress: OWNER,
    });

    expect(finalized.status).toBe("finalized");
    expect(finalized.attachments[0].all_chunks_complete).toBe(true);
    expect(finalized.attachments[0].chunks_uploaded).toBe(2);
  });

  it("returns partial when not all chunks uploaded", async () => {
    const result = initiateUploadSession(makeInitiateInput());

    await uploadChunk({
      sessionId: result.session_id,
      ownerAddress: OWNER,
      attachmentIndex: 0,
      chunkIndex: 0,
      chunkBytes: new Uint8Array([1, 2]),
    });

    const finalized = finalizeUploadSession({
      sessionId: result.session_id,
      ownerAddress: OWNER,
    });

    expect(finalized.status).toBe("partial");
    expect(finalized.attachments[0].all_chunks_complete).toBe(false);
  });

  it("rejects finalize for non-existent session", () => {
    expect(() => finalizeUploadSession({ sessionId: "nonexistent", ownerAddress: OWNER })).toThrow(
      UploadSessionError,
    );
  });
});

describe("upload-session abort", () => {
  it("aborts an active session", async () => {
    const result = initiateUploadSession(makeInitiateInput());
    const abortResult = abortUploadSession({
      sessionId: result.session_id,
      ownerAddress: OWNER,
    });

    expect(abortResult.aborted).toBe(true);
    expect(getUploadSession(result.session_id)).toBeUndefined();
  });

  it("rejects abort for non-existent session", () => {
    expect(() => abortUploadSession({ sessionId: "nonexistent", ownerAddress: OWNER })).toThrow(
      UploadSessionError,
    );
  });
});

describe("upload-session progress", () => {
  it("reports uploaded chunks", async () => {
    const result = initiateUploadSession(makeInitiateInput());

    await uploadChunk({
      sessionId: result.session_id,
      ownerAddress: OWNER,
      attachmentIndex: 0,
      chunkIndex: 0,
      chunkBytes: new Uint8Array([1, 2]),
    });

    const progress = getUploadSessionProgress({
      sessionId: result.session_id,
      ownerAddress: OWNER,
    });

    expect(progress.status).toBe("uploading");
    expect(progress.attachments[0].uploaded_chunks).toEqual([0]);
  });

  it("rejects progress for non-existent session", () => {
    expect(() =>
      getUploadSessionProgress({ sessionId: "nonexistent", ownerAddress: OWNER }),
    ).toThrow(UploadSessionError);
  });
});

describe("upload-session expiry", () => {
  it("cleans up expired sessions", () => {
    const result = initiateUploadSession({
      ...makeInitiateInput(),
      ttlMs: 0,
    });

    const cleaned = cleanupExpiredSessions(new Date(Date.now() + 1));
    expect(cleaned).toBeGreaterThanOrEqual(1);
    expect(getUploadSession(result.session_id)).toBeUndefined();
  });
});

describe("upload-session resume", () => {
  it("resumes an interrupted upload without duplicating chunks", async () => {
    const result = initiateUploadSession(makeInitiateInput());

    await uploadChunk({
      sessionId: result.session_id,
      ownerAddress: OWNER,
      attachmentIndex: 0,
      chunkIndex: 0,
      chunkBytes: new Uint8Array([1, 2]),
    });

    const progress = getUploadSessionProgress({
      sessionId: result.session_id,
      ownerAddress: OWNER,
    });

    expect(progress.attachments[0].uploaded_chunks).toEqual([0]);

    const second = await uploadChunk({
      sessionId: result.session_id,
      ownerAddress: OWNER,
      attachmentIndex: 0,
      chunkIndex: 1,
      chunkBytes: new Uint8Array([3, 4]),
    });

    expect(second.already_uploaded).toBe(false);

    const finalProgress = getUploadSessionProgress({
      sessionId: result.session_id,
      ownerAddress: OWNER,
    });
    expect(finalProgress.attachments[0].uploaded_chunks).toEqual([0, 1]);
  });
});
