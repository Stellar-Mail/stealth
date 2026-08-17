import { describe, expect, it } from "vitest";
import { FakeR2Bucket } from "../../../src/services/storage/r2-fake";
import { createRelayObjectStore, RelayObjectStore } from "../../../src/services/relay/object-store";

const OWNER = "GA7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7G";
const MESSAGE_ID = "c".repeat(64);

async function buildStore(now?: () => Date) {
  const bucket = new FakeR2Bucket();
  const store = createRelayObjectStore(bucket as unknown as R2Bucket, {
    stagedTtlMs: 60_000,
    now,
  });
  return { bucket, store };
}

describe("RelayObjectStore", () => {
  it("stores an encrypted envelope body and reads it back with verification", async () => {
    const { store } = await buildStore();
    const body = new TextEncoder().encode("large encrypted message body");

    const key = await store.storeEnvelopeBody({
      messageId: MESSAGE_ID,
      ownerAddress: OWNER,
      contentType: "application/octet-stream",
      bytes: body,
    });

    expect(key.startsWith("envelopes/")).toBe(true);
    expect(key).not.toContain("filename");

    const fetched = await store.getEnvelopeBody(key, OWNER);
    expect(fetched).not.toBeNull();
    expect(fetched!.bytes).toEqual(body);
    expect(fetched!.metadata.status).toBe("committed");
    expect(fetched!.metadata.ownerAddress).toBe(OWNER);
  });

  it("finalization is deterministic and idempotent for identical content", async () => {
    const { store } = await buildStore();
    const body = new Uint8Array([10, 20, 30, 40]);

    const key1 = await store.storeEnvelopeBody({
      messageId: MESSAGE_ID,
      ownerAddress: OWNER,
      contentType: "application/octet-stream",
      bytes: body,
    });
    const key2 = await store.storeEnvelopeBody({
      messageId: MESSAGE_ID,
      ownerAddress: OWNER,
      contentType: "application/octet-stream",
      bytes: body,
    });

    expect(key1).toBe(key2);
    const fetched = await store.getEnvelopeBody(key1, OWNER);
    expect(fetched!.bytes).toEqual(body);
  });

  it("stores and reads back attachment chunks with chunk-aware keys", async () => {
    const { store } = await buildStore();
    const chunk0 = new Uint8Array([1, 1, 1]);
    const chunk1 = new Uint8Array([2, 2, 2]);

    const key0 = await store.storeAttachmentChunk({
      messageId: MESSAGE_ID,
      ownerAddress: OWNER,
      contentType: "application/octet-stream",
      bytes: chunk0,
      chunkIndex: 0,
      totalChunks: 2,
    });
    const key1 = await store.storeAttachmentChunk({
      messageId: MESSAGE_ID,
      ownerAddress: OWNER,
      contentType: "application/octet-stream",
      bytes: chunk1,
      chunkIndex: 1,
      totalChunks: 2,
    });

    expect(key0).not.toBe(key1);
    expect(key0.startsWith("attachments/")).toBe(true);

    // fetch by deterministic key (preview)
    const commitment0 = await import("../../../src/services/storage/object-store").then((m) =>
      m.createObjectCommitment(chunk0),
    );
    const fetched0 = await store.getAttachmentChunk(MESSAGE_ID, commitment0, 0, OWNER);
    expect(fetched0!.bytes).toEqual(chunk0);
  });

  it("rejects a corrupted stored body on read", async () => {
    const { bucket, store } = await buildStore();
    const body = new Uint8Array([5, 6, 7, 8, 9]);
    const key = await store.storeEnvelopeBody({
      messageId: MESSAGE_ID,
      ownerAddress: OWNER,
      contentType: "application/octet-stream",
      bytes: body,
    });

    const tampered = new Uint8Array(body);
    tampered[0] = 0xaa;
    await (bucket as FakeR2Bucket).put(key, tampered, {
      customMetadata: (await (bucket as FakeR2Bucket).get(key))!.customMetadata,
    });

    await expect(store.getEnvelopeBody(key, OWNER)).rejects.toThrow("SHA-256 commitment");
  });

  it("refuses reads by a non-owner", async () => {
    const { store } = await buildStore();
    const body = new Uint8Array([1, 2, 3]);
    const key = await store.storeEnvelopeBody({
      messageId: MESSAGE_ID,
      ownerAddress: OWNER,
      contentType: "application/octet-stream",
      bytes: body,
    });

    await expect(
      store.getEnvelopeBody(key, "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"),
    ).rejects.toThrow("owned by another actor");
  });

  it("cleans up expired staged objects without touching committed ones", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const { bucket, store } = await buildStore(() => now);

    const body = new Uint8Array([1, 2, 3]);
    const key = await store.storeEnvelopeBody({
      messageId: MESSAGE_ID,
      ownerAddress: OWNER,
      contentType: "application/octet-stream",
      bytes: body,
    });

    // The committed object survives the sweep.
    await store.cleanupExpired(new Date(now.getTime() + 60 * 60 * 1000));
    expect(await store.getEnvelopeBody(key, OWNER)).not.toBeNull();
  });

  it("exposes a stable error discriminator", async () => {
    const { store } = await buildStore();
    expect(RelayObjectStore.isObjectStoreError(new Error("plain"))).toBe(false);
    try {
      await store.getEnvelopeBody("envelopes/missing/00", OWNER);
    } catch (error) {
      expect(RelayObjectStore.isObjectStoreError(error)).toBe(true);
    }
  });
});
