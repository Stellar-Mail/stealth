import { describe, expect, it } from "vitest";
import { R2ObjectStoreAdapter } from "../../../src/services/storage/r2-adapter";
import { FakeR2Bucket } from "../../../src/services/storage/r2-fake";
import {
  ATTACHMENT_CHUNK_PREFIX,
  ENVELOPE_BODY_PREFIX,
  STAGING_PREFIX,
  attachmentChunkKey,
  createObjectCommitment,
  envelopeBodyKey,
} from "../../../src/services/storage/object-store";

const OWNER = "GA7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7G";
const MESSAGE_ID = "a".repeat(64);

async function buildAdapter(now?: () => Date) {
  const bucket = new FakeR2Bucket();
  const adapter = new R2ObjectStoreAdapter(bucket as unknown as R2Bucket, {
    stagedTtlMs: 60_000,
    now,
  });
  return { bucket, adapter };
}

async function stageBody(adapter: R2ObjectStoreAdapter, bytes: Uint8Array, overrides = {}) {
  const contentCommitment = await createObjectCommitment(bytes);
  const staged = await adapter.stage({
    kind: "envelope-body",
    messageId: MESSAGE_ID,
    ownerAddress: OWNER,
    contentType: "application/octet-stream",
    contentLength: bytes.length,
    contentCommitment,
    bytes,
    ...overrides,
  });
  return { stagedKey: staged.stagedKey, contentCommitment };
}

describe("R2ObjectStoreAdapter", () => {
  it("stages a body under the staging prefix and keeps it unreadable", async () => {
    const { bucket, adapter } = await buildAdapter();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const { stagedKey, contentCommitment } = await stageBody(adapter, bytes);

    expect(stagedKey.startsWith(STAGING_PREFIX)).toBe(true);
    expect(bucket.peek(stagedKey)).toEqual(bytes);

    const finalKey = envelopeBodyKey(MESSAGE_ID, contentCommitment);
    expect(bucket.peek(finalKey)).toBeNull();

    // The staged object is never served through the committed read path.
    await expect(adapter.get(stagedKey)).rejects.toThrow("not been finalized");
  });

  it("finalizes a staged body into a deterministic content-addressed key", async () => {
    const { bucket, adapter } = await buildAdapter();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const { stagedKey, contentCommitment } = await stageBody(adapter, bytes);

    const result = await adapter.finalize({
      stagedKey,
      ownerAddress: OWNER,
      expectedContentLength: bytes.length,
      expectedCommitment: contentCommitment,
    });

    expect(result.key).toBe(envelopeBodyKey(MESSAGE_ID, contentCommitment));
    expect(result.metadata.status).toBe("committed");
    expect(bucket.peek(stagedKey)).toBeNull();

    const fetched = await adapter.get(result.key, { ownerAddress: OWNER });
    expect(fetched).not.toBeNull();
    expect(fetched!.bytes).toEqual(bytes);
    expect(fetched!.metadata.contentCommitment).toBe(contentCommitment);
  });

  it("rejects finalization when the ownership does not match", async () => {
    const { adapter } = await buildAdapter();
    const bytes = new Uint8Array([9, 9, 9]);
    const { stagedKey, contentCommitment } = await stageBody(adapter, bytes);

    await expect(
      adapter.finalize({
        stagedKey,
        ownerAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        expectedContentLength: bytes.length,
        expectedCommitment: contentCommitment,
      }),
    ).rejects.toThrow("owned by another actor");
  });

  it("rejects finalization when the content commitment does not match", async () => {
    const { adapter } = await buildAdapter();
    const bytes = new Uint8Array([1, 2, 3]);
    const { stagedKey } = await stageBody(adapter, bytes);

    const otherCommitment = await createObjectCommitment(new Uint8Array([4, 5, 6]));
    await expect(
      adapter.finalize({
        stagedKey,
        ownerAddress: OWNER,
        expectedContentLength: bytes.length,
        expectedCommitment: otherCommitment,
      }),
    ).rejects.toThrow("SHA-256 commitment");
  });

  it("rejects finalization when the content length does not match", async () => {
    const { adapter } = await buildAdapter();
    const bytes = new Uint8Array([1, 2, 3]);
    const { stagedKey, contentCommitment } = await stageBody(adapter, bytes);

    await expect(
      adapter.finalize({
        stagedKey,
        ownerAddress: OWNER,
        expectedContentLength: bytes.length + 1,
        expectedCommitment: contentCommitment,
      }),
    ).rejects.toThrow("length mismatch");
  });

  it("rejects finalization when the declared media metadata does not match", async () => {
    const { adapter } = await buildAdapter();
    const bytes = new Uint8Array([1, 2, 3]);
    const { stagedKey, contentCommitment } = await stageBody(adapter, bytes);

    await expect(
      adapter.finalize({
        stagedKey,
        ownerAddress: OWNER,
        expectedContentLength: bytes.length,
        expectedCommitment: contentCommitment,
        expectedContentType: "image/png",
      }),
    ).rejects.toThrow("media metadata");
  });

  it("detects corruption on get and refuses to serve tampered bytes", async () => {
    const { bucket, adapter } = await buildAdapter();
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const { stagedKey, contentCommitment } = await stageBody(adapter, bytes);
    const result = await adapter.finalize({
      stagedKey,
      ownerAddress: OWNER,
      expectedContentLength: bytes.length,
      expectedCommitment: contentCommitment,
    });

    // Simulate corruption in the backing store after finalization: the bytes
    // change but the stored metadata is preserved, so the read path must catch
    // the SHA-256 commitment mismatch rather than a metadata parse error.
    const tampered = new Uint8Array(bytes);
    tampered[0] = 0xff;
    await (bucket as FakeR2Bucket).put(result.key, tampered, {
      customMetadata: (await (bucket as FakeR2Bucket).get(result.key))!.customMetadata,
    });

    await expect(adapter.get(result.key, { ownerAddress: OWNER })).rejects.toThrow(
      "SHA-256 commitment",
    );
  });

  it("rejects reads by a non-owner", async () => {
    const { adapter } = await buildAdapter();
    const bytes = new Uint8Array([1, 2, 3]);
    const { stagedKey, contentCommitment } = await stageBody(adapter, bytes);
    const result = await adapter.finalize({
      stagedKey,
      ownerAddress: OWNER,
      expectedContentLength: bytes.length,
      expectedCommitment: contentCommitment,
    });

    await expect(
      adapter.get(result.key, {
        ownerAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      }),
    ).rejects.toThrow("owned by another actor");
  });

  it("stages and finalizes attachment chunks with deterministic keys", async () => {
    const { adapter } = await buildAdapter();
    const chunk = new Uint8Array([7, 8, 9]);
    const chunkCommitment = await createObjectCommitment(chunk);
    const staged = await adapter.stage({
      kind: "attachment-chunk",
      messageId: MESSAGE_ID,
      ownerAddress: OWNER,
      contentType: "application/octet-stream",
      contentLength: chunk.length,
      contentCommitment: chunkCommitment,
      bytes: chunk,
      chunkIndex: 2,
      totalChunks: 3,
    });

    const result = await adapter.finalize({
      stagedKey: staged.stagedKey,
      ownerAddress: OWNER,
      expectedContentLength: chunk.length,
      expectedCommitment: chunkCommitment,
    });

    expect(result.key).toBe(attachmentChunkKey(MESSAGE_ID, chunkCommitment, 2));
    expect(result.metadata.chunkIndex).toBe(2);
    expect(result.metadata.totalChunks).toBe(3);

    const fetched = await adapter.get(result.key, { ownerAddress: OWNER });
    expect(fetched!.bytes).toEqual(chunk);
  });

  it("cleans up expired staged objects (orphan cleanup)", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const { bucket, adapter } = await buildAdapter(() => now);

    const bytes = new Uint8Array([1, 2, 3]);
    const { stagedKey } = await stageBody(adapter, bytes, { ttlMs: 30_000 });

    // Within TTL: nothing is removed.
    expect(await adapter.cleanupExpired(new Date(now.getTime() + 10_000))).toBe(0);
    expect(bucket.peek(stagedKey)).not.toBeNull();

    // After TTL: the staged object is swept.
    expect(await adapter.cleanupExpired(new Date(now.getTime() + 31_000))).toBe(1);
    expect(bucket.peek(stagedKey)).toBeNull();
  });

  it("does not remove committed objects during cleanup", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const { bucket, adapter } = await buildAdapter(() => now);

    const bytes = new Uint8Array([1, 2, 3, 4]);
    const { stagedKey, contentCommitment } = await stageBody(adapter, bytes, {
      ttlMs: 5_000,
    });
    const result = await adapter.finalize({
      stagedKey,
      ownerAddress: OWNER,
      expectedContentLength: bytes.length,
      expectedCommitment: contentCommitment,
    });

    await adapter.cleanupExpired(new Date(now.getTime() + 60_000));
    expect(bucket.peek(result.key)).not.toBeNull();
  });

  it("delete removes a committed object", async () => {
    const { bucket, adapter } = await buildAdapter();
    const bytes = new Uint8Array([1, 2, 3]);
    const { stagedKey, contentCommitment } = await stageBody(adapter, bytes);
    const result = await adapter.finalize({
      stagedKey,
      ownerAddress: OWNER,
      expectedContentLength: bytes.length,
      expectedCommitment: contentCommitment,
    });

    await adapter.delete(result.key);
    expect(bucket.peek(result.key)).toBeNull();
    expect(await adapter.get(result.key, { ownerAddress: OWNER })).toBeNull();
  });

  it("round-trips a full journey: stage -> finalize -> verified get", async () => {
    const { adapter } = await buildAdapter();
    const body = new TextEncoder().encode("large encrypted message body");
    const commitment = await createObjectCommitment(body);
    const staged = await adapter.stage({
      kind: "envelope-body",
      messageId: MESSAGE_ID,
      ownerAddress: OWNER,
      contentType: "application/octet-stream",
      contentLength: body.length,
      contentCommitment: commitment,
      bytes: body,
    });

    const finalKey = envelopeBodyKey(MESSAGE_ID, commitment);
    expect(staged.stagedKey.startsWith(STAGING_PREFIX)).toBe(true);

    const finalized = await adapter.finalize({
      stagedKey: staged.stagedKey,
      ownerAddress: OWNER,
      expectedContentLength: body.length,
      expectedCommitment: commitment,
    });
    expect(finalized.key).toBe(finalKey);

    const fetched = await adapter.get(finalKey, { ownerAddress: OWNER });
    expect(new TextDecoder().decode(fetched!.bytes)).toBe("large encrypted message body");

    // Deterministic naming: same message + content maps to the same key.
    expect(finalKey).toMatch(new RegExp(`^${ENVELOPE_BODY_PREFIX}`));
    expect(finalKey).not.toContain("filename");
  });
});
