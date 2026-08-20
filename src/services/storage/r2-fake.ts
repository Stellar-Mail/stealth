/**
 * Local in-memory R2 bucket fake (#1937 / BETA-030).
 *
 * Mirrors the subset of the Cloudflare R2 API surface used by
 * {@link R2ObjectStoreAdapter}: put, get, delete, and list. Keeping the fake
 * adjacent to the adapter means the local test suite exercises the same code
 * path as a real Cloudflare integration test without needing a deployed bucket.
 */

interface FakeStoredObject {
  key: string;
  bytes: Uint8Array;
  uploaded: Date;
  customMetadata: Record<string, string>;
}

export class FakeR2Bucket {
  private readonly objects = new Map<string, FakeStoredObject>();

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | null,
    options?: { customMetadata?: Record<string, string> },
  ): Promise<R2Object> {
    const bytes = await toBytes(value);
    const uploaded = new Date();
    this.objects.set(key, {
      key,
      bytes,
      uploaded,
      customMetadata: options?.customMetadata ?? {},
    });
    return {
      key,
      size: bytes.length,
      uploaded,
      etag: `${key}-${bytes.length}`,
      httpMetadata: {},
      customMetadata: options?.customMetadata ?? {},
      checksums: {},
    };
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const stored = this.objects.get(key);
    if (!stored) return null;
    return {
      key: stored.key,
      size: stored.bytes.length,
      uploaded: stored.uploaded,
      etag: `${stored.key}-${stored.bytes.length}`,
      httpMetadata: {},
      customMetadata: stored.customMetadata,
      checksums: {},
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(stored.bytes);
          controller.close();
        },
      }),
      async arrayBuffer() {
        return stored.bytes.slice().buffer as ArrayBuffer;
      },
      async text() {
        return new TextDecoder().decode(stored.bytes);
      },
      async json<T>(): Promise<T> {
        return JSON.parse(new TextDecoder().decode(stored.bytes)) as T;
      },
    };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async list(options: { prefix?: string; cursor?: string } = {}): Promise<R2Objects> {
    const prefix = options.prefix ?? "";
    const keys = [...this.objects.keys()].filter((key) => key.startsWith(prefix)).sort();
    const objects = keys.map((key) => {
      const stored = this.objects.get(key)!;
      return {
        key: stored.key,
        size: stored.bytes.length,
        uploaded: stored.uploaded,
        etag: `${stored.key}-${stored.bytes.length}`,
        httpMetadata: {},
        customMetadata: stored.customMetadata,
        checksums: {},
      };
    });
    return { objects, truncated: false, delimitedPrefixes: [] };
  }

  /** Test helper: returns the raw stored bytes for a key without validation. */
  peek(key: string): Uint8Array | null {
    return this.objects.get(key)?.bytes ?? null;
  }

  /** Test helper: total object count (staged + committed). */
  get size(): number {
    return this.objects.size;
  }
}

async function toBytes(
  value: ArrayBuffer | ArrayBufferView | ReadableStream | string | null,
): Promise<Uint8Array> {
  if (value === null) return new Uint8Array();
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
    );
  }
  // ReadableStream
  const reader = value.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    chunks.push(chunk);
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
