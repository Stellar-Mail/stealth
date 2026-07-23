import { describe, expect, it } from "vitest";

import {
  AttachmentStreamError,
  DEFAULT_CHUNK_SIZE_BYTES,
  MIN_CHUNK_SIZE_BYTES,
  decryptAttachmentStream,
  encryptAttachmentStream,
  generateAttachmentKey,
  type AttachmentStreamManifest,
  type EncryptedChunkFrame,
} from "../../../src/services/crypto/attachment-stream";

async function* singleChunkSource(bytes: Uint8Array): AsyncGenerator<Uint8Array> {
  yield bytes;
}

async function* fragmentedSource(
  bytes: Uint8Array,
  fragmentSize: number,
): AsyncGenerator<Uint8Array> {
  for (let offset = 0; offset < bytes.length; offset += fragmentSize) {
    yield bytes.subarray(offset, offset + fragmentSize);
  }
  if (bytes.length === 0) {
    yield new Uint8Array(0);
  }
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

async function collectFrames(
  chunks: AsyncGenerator<EncryptedChunkFrame, void, void>,
): Promise<EncryptedChunkFrame[]> {
  const frames: EncryptedChunkFrame[] = [];
  for await (const frame of chunks) {
    frames.push(frame);
  }
  return frames;
}

async function* toAsyncIterable(
  frames: EncryptedChunkFrame[],
): AsyncGenerator<EncryptedChunkFrame> {
  for (const frame of frames) {
    yield frame;
  }
}

async function decryptAll(
  key: CryptoKey,
  manifest: AttachmentStreamManifest,
  frames: EncryptedChunkFrame[],
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for await (const part of decryptAttachmentStream(key, manifest, toAsyncIterable(frames))) {
    parts.push(part);
  }
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function encryptAll(
  key: CryptoKey,
  plaintext: Uint8Array,
  chunkSizeBytes: number,
): Promise<{ frames: EncryptedChunkFrame[]; manifest: AttachmentStreamManifest }> {
  const { chunks, manifest } = encryptAttachmentStream(key, singleChunkSource(plaintext), {
    chunkSizeBytes,
  });
  const frames = await collectFrames(chunks);
  return { frames, manifest: await manifest };
}

describe("crypto/attachment-stream", () => {
  it("round-trips a small single-chunk attachment", async () => {
    const key = await generateAttachmentKey();
    const plaintext = new TextEncoder().encode("hello streaming world");
    const { frames, manifest } = await encryptAll(key, plaintext, DEFAULT_CHUNK_SIZE_BYTES);

    expect(frames).toHaveLength(1);
    expect(frames[0].final).toBe(true);
    expect(manifest.chunk_count).toBe(1);
    expect(manifest.total_size_bytes).toBe(plaintext.length);

    const decrypted = await decryptAll(key, manifest, frames);
    expect(decrypted).toEqual(plaintext);
  });

  it("round-trips a multi-chunk attachment fed as fragmented reads", async () => {
    const key = await generateAttachmentKey();
    const chunkSize = MIN_CHUNK_SIZE_BYTES;
    const plaintext = randomBytes(chunkSize * 5 + 17);

    const { chunks, manifest } = encryptAttachmentStream(key, fragmentedSource(plaintext, 233), {
      chunkSizeBytes: chunkSize,
    });
    const frames = await collectFrames(chunks);
    const resolvedManifest = await manifest;

    expect(resolvedManifest.chunk_count).toBe(6);
    expect(frames.map((f) => f.sequence)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(frames.filter((f) => f.final)).toHaveLength(1);
    expect(frames[frames.length - 1].final).toBe(true);

    const decrypted = await decryptAll(key, resolvedManifest, frames);
    expect(decrypted).toEqual(plaintext);
  });

  it("does not emit a trailing empty chunk when input is an exact multiple of chunk size", async () => {
    const key = await generateAttachmentKey();
    const chunkSize = MIN_CHUNK_SIZE_BYTES;
    const plaintext = randomBytes(chunkSize * 3);

    const { frames, manifest } = await encryptAll(key, plaintext, chunkSize);

    expect(manifest.chunk_count).toBe(3);
    expect(frames[2].final).toBe(true);

    const decrypted = await decryptAll(key, manifest, frames);
    expect(decrypted).toEqual(plaintext);
  });

  it("handles a zero-byte attachment as a single empty final chunk", async () => {
    const key = await generateAttachmentKey();
    const { frames, manifest } = await encryptAll(key, new Uint8Array(0), DEFAULT_CHUNK_SIZE_BYTES);

    expect(frames).toHaveLength(1);
    expect(frames[0].final).toBe(true);
    expect(manifest.chunk_count).toBe(1);
    expect(manifest.total_size_bytes).toBe(0);

    const decrypted = await decryptAll(key, manifest, frames);
    expect(decrypted).toEqual(new Uint8Array(0));
  });

  it("handles input exactly one byte past a chunk boundary", async () => {
    const key = await generateAttachmentKey();
    const chunkSize = MIN_CHUNK_SIZE_BYTES;
    const plaintext = randomBytes(chunkSize + 1);

    const { frames, manifest } = await encryptAll(key, plaintext, chunkSize);

    expect(manifest.chunk_count).toBe(2);
    expect(frames[0].final).toBe(false);
    expect(frames[1].final).toBe(true);

    const decrypted = await decryptAll(key, manifest, frames);
    expect(decrypted).toEqual(plaintext);
  });

  it("rejects a corrupted ciphertext byte", async () => {
    const key = await generateAttachmentKey();
    const plaintext = randomBytes(MIN_CHUNK_SIZE_BYTES * 3 + 50);
    const { frames, manifest } = await encryptAll(key, plaintext, MIN_CHUNK_SIZE_BYTES);

    const tampered = [...frames];
    const cipherBytes = Uint8Array.from(atob(tampered[0].ciphertext), (c) => c.charCodeAt(0));
    cipherBytes[0] ^= 0xff;
    tampered[0] = {
      ...tampered[0],
      ciphertext: btoa(String.fromCharCode(...cipherBytes)),
    };

    await expect(decryptAll(key, manifest, tampered)).rejects.toThrow(AttachmentStreamError);
  });

  it("rejects a tampered auth tag (mac) on an otherwise untouched chunk", async () => {
    const key = await generateAttachmentKey();
    const plaintext = randomBytes(MIN_CHUNK_SIZE_BYTES * 3 + 50);
    const { frames, manifest } = await encryptAll(key, plaintext, MIN_CHUNK_SIZE_BYTES);

    const tampered = [...frames];
    tampered[0] = {
      ...tampered[0],
      mac:
        tampered[0].mac[0] === "0"
          ? "1" + tampered[0].mac.slice(1)
          : "0" + tampered[0].mac.slice(1),
    };

    await expect(decryptAll(key, manifest, tampered)).rejects.toThrow(/failed authentication/);
  });

  it("rejects reordered chunks", async () => {
    const key = await generateAttachmentKey();
    const plaintext = randomBytes(MIN_CHUNK_SIZE_BYTES * 3 + 50);
    const { frames, manifest } = await encryptAll(key, plaintext, MIN_CHUNK_SIZE_BYTES);

    const reordered = [frames[1], frames[0], ...frames.slice(2)];
    await expect(decryptAll(key, manifest, reordered)).rejects.toThrow(/sequence mismatch/);
  });

  it("rejects a duplicated chunk", async () => {
    const key = await generateAttachmentKey();
    const plaintext = randomBytes(MIN_CHUNK_SIZE_BYTES * 3 + 50);
    const { frames, manifest } = await encryptAll(key, plaintext, MIN_CHUNK_SIZE_BYTES);

    const duplicated = [frames[0], frames[0], ...frames.slice(1)];
    await expect(decryptAll(key, manifest, duplicated)).rejects.toThrow(AttachmentStreamError);
  });

  it("rejects a chunk substituted from a different attachment stream", async () => {
    const key = await generateAttachmentKey();
    const { frames: framesA, manifest: manifestA } = await encryptAll(
      key,
      randomBytes(MIN_CHUNK_SIZE_BYTES * 3 + 50),
      MIN_CHUNK_SIZE_BYTES,
    );
    const { frames: framesB } = await encryptAll(
      key,
      randomBytes(MIN_CHUNK_SIZE_BYTES * 3 + 50),
      MIN_CHUNK_SIZE_BYTES,
    );

    const substituted = [framesB[0], ...framesA.slice(1)];
    await expect(decryptAll(key, manifestA, substituted)).rejects.toThrow(AttachmentStreamError);
  });

  it("rejects a truncated stream missing its final chunk", async () => {
    const key = await generateAttachmentKey();
    const plaintext = randomBytes(MIN_CHUNK_SIZE_BYTES * 3 + 50);
    const { frames, manifest } = await encryptAll(key, plaintext, MIN_CHUNK_SIZE_BYTES);

    const truncated = frames.slice(0, frames.length - 1);
    await expect(decryptAll(key, manifest, truncated)).rejects.toThrow(/truncated/);
  });

  it("rejects a manifest whose MAC does not match the chunk stream", async () => {
    const key = await generateAttachmentKey();
    const plaintext = randomBytes(MIN_CHUNK_SIZE_BYTES * 3 + 50);
    const { frames, manifest } = await encryptAll(key, plaintext, MIN_CHUNK_SIZE_BYTES);

    const tamperedManifest: AttachmentStreamManifest = {
      ...manifest,
      manifest_mac: manifest.manifest_mac.replace(
        /^./,
        manifest.manifest_mac[0] === "0" ? "1" : "0",
      ),
    };

    await expect(decryptAll(key, tamperedManifest, frames)).rejects.toThrow(
      /manifest authentication failed/,
    );
  });

  it("rejects decryption under the wrong key", async () => {
    const key = await generateAttachmentKey();
    const otherKey = await generateAttachmentKey();
    const plaintext = randomBytes(MIN_CHUNK_SIZE_BYTES * 3 + 50);
    const { frames, manifest } = await encryptAll(key, plaintext, MIN_CHUNK_SIZE_BYTES);

    await expect(decryptAll(otherKey, manifest, frames)).rejects.toThrow(AttachmentStreamError);
  });

  it("cancels encryption via an AbortSignal and releases the source", async () => {
    const key = await generateAttachmentKey();
    let released = false;

    async function* infiniteSource(): AsyncGenerator<Uint8Array> {
      try {
        for (;;) {
          yield randomBytes(16);
        }
      } finally {
        released = true;
      }
    }

    const controller = new AbortController();
    const { chunks, manifest } = encryptAttachmentStream(key, infiniteSource(), {
      chunkSizeBytes: MIN_CHUNK_SIZE_BYTES,
      signal: controller.signal,
    });

    const iterator = chunks[Symbol.asyncIterator]();
    await iterator.next();
    controller.abort();

    await expect(iterator.next()).rejects.toThrow(AttachmentStreamError);
    await expect(manifest).rejects.toThrow(AttachmentStreamError);
    expect(released).toBe(true);
  });

  it("releases the source when the consumer stops iterating early", async () => {
    const key = await generateAttachmentKey();
    let released = false;

    async function* infiniteSource(): AsyncGenerator<Uint8Array> {
      try {
        for (;;) {
          yield randomBytes(16);
        }
      } finally {
        released = true;
      }
    }

    const { chunks } = encryptAttachmentStream(key, infiniteSource(), {
      chunkSizeBytes: MIN_CHUNK_SIZE_BYTES,
    });

    for await (const _frame of chunks) {
      break;
    }

    expect(released).toBe(true);
  });

  it("adapts a getReader()-only source (no Symbol.asyncIterator)", async () => {
    const key = await generateAttachmentKey();
    const plaintext = randomBytes(MIN_CHUNK_SIZE_BYTES * 2 + 50);
    const webStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(plaintext.subarray(0, MIN_CHUNK_SIZE_BYTES));
        controller.enqueue(plaintext.subarray(MIN_CHUNK_SIZE_BYTES));
        controller.close();
      },
    });

    // Strip Symbol.asyncIterator to force the getReader()-based fallback path.
    const readerOnlySource = {
      getReader: () => webStream.getReader(),
    } as unknown as ReadableStream<Uint8Array>;

    const { chunks, manifest } = encryptAttachmentStream(key, readerOnlySource, {
      chunkSizeBytes: MIN_CHUNK_SIZE_BYTES,
    });
    const frames = await collectFrames(chunks);
    const resolvedManifest = await manifest;

    const decrypted = await decryptAll(key, resolvedManifest, frames);
    expect(decrypted).toEqual(plaintext);
  });
});
