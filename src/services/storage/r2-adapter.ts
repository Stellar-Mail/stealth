/**
 * R2-backed encrypted object storage adapter (#1937 / BETA-030).
 *
 * Implements the {@link ObjectStoreAdapter} contract against a Cloudflare R2
 * bucket. Writes are staged under a random key with a short expiry and only
 * become readable after {@link finalize} verifies content length, the SHA-256
 * commitment, media metadata, and ownership. Reads re-verify the commitment so
 * a corrupted object can never be served. `cleanupExpired` removes staged
 * objects whose TTL has lapsed so partial uploads and abandoned objects expire
 * safely.
 */

import {
  DEFAULT_STAGED_TTL_MS,
  STAGING_PREFIX,
  assertValidMetadata,
  attachmentChunkKey,
  deserializeMetadata,
  envelopeBodyKey,
  isExpired,
  OBJECT_KIND_ATTACHMENT_CHUNK,
  ObjectStoreError,
  serializeMetadata,
  validateStageInput,
  verifyObjectIntegrity,
  type FinalizeObjectInput,
  type ObjectKind,
  type ObjectStoreAdapter,
  type ObjectStoreMetadata,
  type StageObjectInput,
  type StoredObject,
} from "./object-store";

function toBytes(input: Uint8Array | ArrayBuffer): Uint8Array {
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class R2ObjectStoreAdapter implements ObjectStoreAdapter {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly options: { stagedTtlMs?: number; now?: () => Date } = {},
  ) {}

  private now(): Date {
    return this.options.now ? this.options.now() : new Date();
  }

  private stagedTtlMs(): number {
    return this.options.stagedTtlMs ?? DEFAULT_STAGED_TTL_MS;
  }

  async stage(input: StageObjectInput): Promise<{ stagedKey: string }> {
    validateStageInput(input);

    const now = this.now();
    const expiresAt = new Date(now.getTime() + (input.ttlMs ?? this.stagedTtlMs()));

    const metadata: ObjectStoreMetadata = {
      version: "v1",
      kind: input.kind,
      messageId: input.messageId,
      ownerAddress: input.ownerAddress,
      contentType: input.contentType,
      contentLength: input.contentLength,
      contentCommitment: input.contentCommitment,
      ...(input.kind === OBJECT_KIND_ATTACHMENT_CHUNK
        ? {
            chunkIndex: input.chunkIndex,
            totalChunks: input.totalChunks,
          }
        : {}),
      status: "staged",
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const stagedKey = `${STAGING_PREFIX}${randomHex(16)}`;
    await this.bucket.put(stagedKey, toBytes(input.bytes), {
      customMetadata: serializeMetadata(metadata),
    });
    return { stagedKey };
  }

  async finalize(
    input: FinalizeObjectInput,
  ): Promise<{ key: string; metadata: ObjectStoreMetadata }> {
    const staged = await this.bucket.get(input.stagedKey);
    if (!staged) {
      throw new ObjectStoreError("object_store_not_found", "Staged object not found");
    }

    const stagedBytes = new Uint8Array(await staged.arrayBuffer());
    const metadata = deserializeMetadata(staged.customMetadata);
    assertValidMetadata(metadata);

    if (metadata.status !== "staged") {
      throw new ObjectStoreError("object_store_conflict", "Object is not in staged state");
    }

    // Ownership: only the actor who owns the staged object may finalize it.
    if (metadata.ownerAddress !== input.ownerAddress) {
      throw new ObjectStoreError(
        "object_store_ownership_error",
        "Cannot finalize an object owned by another actor",
      );
    }

    // Media metadata: when the caller declares an expected content type it must match.
    if (
      input.expectedContentType !== undefined &&
      metadata.contentType !== input.expectedContentType
    ) {
      throw new ObjectStoreError(
        "object_store_integrity_error",
        "Object media metadata does not match the expected content type",
      );
    }

    // Length + SHA-256 commitment before the object becomes readable.
    await verifyObjectIntegrity({
      bytes: stagedBytes,
      contentLength: input.expectedContentLength,
      contentCommitment: input.expectedCommitment,
    });

    const finalKey =
      metadata.kind === OBJECT_KIND_ATTACHMENT_CHUNK
        ? attachmentChunkKey(
            metadata.messageId,
            metadata.contentCommitment,
            metadata.chunkIndex ?? 0,
          )
        : envelopeBodyKey(metadata.messageId, metadata.contentCommitment);

    const committedMetadata: ObjectStoreMetadata = {
      ...metadata,
      status: "committed",
      expiresAt: undefined,
    };

    await this.bucket.put(finalKey, stagedBytes, {
      customMetadata: serializeMetadata(committedMetadata),
    });
    await this.bucket.delete(input.stagedKey);

    return { key: finalKey, metadata: committedMetadata };
  }

  async get(key: string, options: { ownerAddress?: string } = {}): Promise<StoredObject | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;

    const metadata = deserializeMetadata(object.customMetadata);
    assertValidMetadata(metadata);

    if (metadata.status !== "committed") {
      // A staged object is never served through the committed read path.
      throw new ObjectStoreError("object_store_conflict", "Object has not been finalized");
    }

    // Ownership: reads are restricted to the owning actor.
    if (options.ownerAddress !== undefined && metadata.ownerAddress !== options.ownerAddress) {
      throw new ObjectStoreError(
        "object_store_ownership_error",
        "Object is owned by another actor",
      );
    }

    const bytes = new Uint8Array(await object.arrayBuffer());
    await verifyObjectIntegrity({
      bytes,
      contentLength: metadata.contentLength,
      contentCommitment: metadata.contentCommitment,
    });

    return { key, bytes, metadata };
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  /**
   * Removes staged objects whose expiry has lapsed (orphan cleanup). Partial
   * uploads and abandoned objects expire safely instead of accumulating in the
   * staging namespace indefinitely.
   */
  async cleanupExpired(now?: Date): Promise<number> {
    const reference = now ?? this.now();
    let removed = 0;
    let cursor: string | undefined;

    do {
      const result = await this.bucket.list({
        prefix: STAGING_PREFIX,
        ...(cursor ? { cursor } : {}),
      });
      for (const object of result.objects) {
        let metadata: ObjectStoreMetadata;
        try {
          metadata = deserializeMetadata(object.customMetadata);
        } catch {
          // Orphaned object with unreadable metadata is expired garbage; remove it.
          await this.bucket.delete(object.key);
          removed += 1;
          continue;
        }
        if (isExpired(metadata, reference)) {
          await this.bucket.delete(object.key);
          removed += 1;
        }
      }
      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor);

    return removed;
  }
}
