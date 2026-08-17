import { beforeEach, describe, expect, it } from "vitest";

import {
  computeAttachmentCommitment,
  computeChunkHash,
} from "../../../src/services/crypto/attachment-stream";
import {
  AttachmentStorageError,
  AttachmentStorageService,
} from "../../../src/services/storage/attachment-storage";

const sender = `G${"A".repeat(55)}`;
const recipient = `G${"B".repeat(55)}`;
const stranger = `G${"C".repeat(55)}`;

describe("AttachmentStorageService", () => {
  let service: AttachmentStorageService;

  beforeEach(() => {
    service = new AttachmentStorageService();
  });

  it("initiates upload session and sanitizes metadata", async () => {
    const session = await service.initiateSession({
      messageId: "msg_123",
      sender,
      recipient,
      filename: "../../../secret.pdf<script>",
      contentType: "text/html",
      size: 1024,
      chunkCount: 2,
      commitment: "test_commitment",
    });

    expect(session.attachmentId).toBeDefined();
    expect(session.filename).toBe("secret.pdf");
    expect(session.contentType).toBe("application/octet-stream"); // Dangerous text/html sanitized
    expect(session.status).toBe("initiating");
    expect(session.uploadedChunks).toEqual([]);
  });

  it("uploads chunks with checksum verification and handles idempotency", async () => {
    const session = await service.initiateSession({
      messageId: "msg_123",
      sender,
      recipient,
      filename: "report.pdf",
      contentType: "application/pdf",
      size: 100,
      chunkCount: 2,
      commitment: "commitment_123",
    });

    const chunk0 = new TextEncoder().encode("Chunk 0 data string");
    const hash0 = await computeChunkHash(chunk0);

    // Upload chunk 0
    const res1 = await service.uploadChunk({
      attachmentId: session.attachmentId,
      chunkIndex: 0,
      data: chunk0,
      chunkHash: hash0,
      actorId: sender,
    });

    expect(res1.success).toBe(true);
    expect(res1.isDuplicate).toBe(false);

    // Idempotent retry of chunk 0
    const res2 = await service.uploadChunk({
      attachmentId: session.attachmentId,
      chunkIndex: 0,
      data: chunk0,
      chunkHash: hash0,
      actorId: sender,
    });

    expect(res2.success).toBe(true);
    expect(res2.isDuplicate).toBe(true);
  });

  it("rejects unauthorized uploaders", async () => {
    const session = await service.initiateSession({
      messageId: "msg_123",
      sender,
      recipient,
      filename: "report.pdf",
      contentType: "application/pdf",
      size: 100,
      chunkCount: 1,
      commitment: "commitment_123",
    });

    const chunk = new TextEncoder().encode("Sample chunk");
    const hash = await computeChunkHash(chunk);

    await expect(
      service.uploadChunk({
        attachmentId: session.attachmentId,
        chunkIndex: 0,
        data: chunk,
        chunkHash: hash,
        actorId: stranger,
      }),
    ).rejects.toThrow(AttachmentStorageError);
  });

  it("rejects corrupt chunk hashes", async () => {
    const session = await service.initiateSession({
      messageId: "msg_123",
      sender,
      recipient,
      filename: "report.pdf",
      contentType: "application/pdf",
      size: 100,
      chunkCount: 1,
      commitment: "commitment_123",
    });

    const chunk = new TextEncoder().encode("Sample chunk");

    await expect(
      service.uploadChunk({
        attachmentId: session.attachmentId,
        chunkIndex: 0,
        data: chunk,
        chunkHash: "wrong_checksum_hash",
        actorId: sender,
      }),
    ).rejects.toThrow(AttachmentStorageError);
  });

  it("completes full upload, finalization, and authenticated download flow", async () => {
    const chunk0 = new TextEncoder().encode("Hello ");
    const chunk1 = new TextEncoder().encode("World!");
    const hash0 = await computeChunkHash(chunk0);
    const hash1 = await computeChunkHash(chunk1);

    const commitment = await computeAttachmentCommitment([hash0, hash1], {
      filename: "hello.txt",
      contentType: "text/plain",
      size: 12,
    });

    const session = await service.initiateSession({
      messageId: "msg_456",
      sender,
      recipient,
      filename: "hello.txt",
      contentType: "text/plain",
      size: 12,
      chunkCount: 2,
      commitment,
    });

    await service.uploadChunk({
      attachmentId: session.attachmentId,
      chunkIndex: 0,
      data: chunk0,
      chunkHash: hash0,
      actorId: sender,
    });

    await service.uploadChunk({
      attachmentId: session.attachmentId,
      chunkIndex: 1,
      data: chunk1,
      chunkHash: hash1,
      actorId: sender,
    });

    const finalized = await service.finalizeSession(session.attachmentId, sender);
    expect(finalized.status).toBe("finalized");

    // Download by recipient
    const download = await service.getAttachmentContent(session.attachmentId, recipient);
    expect(new TextDecoder().decode(download.data)).toBe("Hello World!");
    expect(download.totalSize).toBe(12);

    // Download by stranger should fail (403 Forbidden)
    await expect(service.getAttachmentContent(session.attachmentId, stranger)).rejects.toThrow(
      AttachmentStorageError,
    );
  });

  it("supports range requests during authenticated download", async () => {
    const chunk0 = new TextEncoder().encode("0123456789");
    const hash0 = await computeChunkHash(chunk0);

    const commitment = await computeAttachmentCommitment([hash0], {
      filename: "numbers.txt",
      contentType: "text/plain",
      size: 10,
    });

    const session = await service.initiateSession({
      messageId: "msg_789",
      sender,
      recipient,
      filename: "numbers.txt",
      contentType: "text/plain",
      size: 10,
      chunkCount: 1,
      commitment,
    });

    await service.uploadChunk({
      attachmentId: session.attachmentId,
      chunkIndex: 0,
      data: chunk0,
      chunkHash: hash0,
      actorId: sender,
    });

    await service.finalizeSession(session.attachmentId, sender);

    // Request byte range 2 to 5 ("2345")
    const downloadRange = await service.getAttachmentContent(session.attachmentId, recipient, {
      start: 2,
      end: 5,
    });

    expect(new TextDecoder().decode(downloadRange.data)).toBe("2345");
    expect(downloadRange.contentRange).toBe("bytes 2-5/10");
  });

  it("aborts session cleanly and purges chunk data", async () => {
    const session = await service.initiateSession({
      messageId: "msg_abort",
      sender,
      recipient,
      filename: "test.dat",
      contentType: "application/octet-stream",
      size: 50,
      chunkCount: 1,
      commitment: "comm_abort",
    });

    const chunk = new TextEncoder().encode("chunk to be aborted");
    const hash = await computeChunkHash(chunk);

    await service.uploadChunk({
      attachmentId: session.attachmentId,
      chunkIndex: 0,
      data: chunk,
      chunkHash: hash,
      actorId: sender,
    });

    await service.abortSession(session.attachmentId, sender);

    const updated = await service.getSession(session.attachmentId, sender);
    expect(updated.status).toBe("aborted");
    expect(updated.uploadedChunks).toEqual([]);

    await expect(service.getAttachmentContent(session.attachmentId, sender)).rejects.toThrow(
      "Attachment upload is not finalized",
    );
  });
});
