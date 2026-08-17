/**
 * Relay object storage (#1937 / BETA-030).
 *
 * The relay accepts encrypted payloads that are large enough that KV and
 * Durable Objects cannot hold them. This service binds the R2 object-store
 * adapter to the relay submission path: the encrypted envelope body and each
 * attachment chunk are staged, integrity-verified (content length, SHA-256
 * commitment, media metadata, ownership), and only then finalized under a
 * deterministic content-addressed key. The original filename and plaintext
 * never appear in any object key or stored metadata.
 *
 * The same storage can be used to fetch a previously stored object; every read
 * re-verifies the SHA-256 commitment so a corrupted object is never served.
 */

import { R2ObjectStoreAdapter } from "@/services/storage/r2-adapter";
import {
  ObjectStoreError,
  attachmentChunkKey,
  createObjectCommitment,
  envelopeBodyKey,
  type ObjectStoreAdapter,
  type StoredObject,
} from "@/services/storage/object-store";

export interface RelayObjectStoreOptions {
  stagedTtlMs?: number;
  now?: () => Date;
}

export interface StoreEnvelopeBodyInput {
  messageId: string;
  ownerAddress: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface StoreAttachmentChunkInput {
  messageId: string;
  ownerAddress: string;
  contentType: string;
  bytes: Uint8Array;
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Constructs the R2-backed object store used by the relay path. Callers outside
 * the Workers runtime can pass their own {@link R2Bucket} (e.g. the local fake)
 * via `bucket`.
 */
export function createRelayObjectStore(
  bucket: R2Bucket,
  options: RelayObjectStoreOptions = {},
): RelayObjectStore {
  return new RelayObjectStore(new R2ObjectStoreAdapter(bucket, options));
}

/**
 * Relay-facing facade over the object-store adapter. Each method performs a
 * stage -> verify -> finalize journey so a payload becomes durable only after
 * its integrity and ownership checks pass.
 */
export class RelayObjectStore {
  private readonly store: ObjectStoreAdapter;

  constructor(store: ObjectStoreAdapter) {
    this.store = store;
  }

  /**
   * Stores an encrypted envelope body under a deterministic content-addressed
   * key. Returns the final key; throws if length, commitment, media metadata,
   * or ownership checks fail.
   */
  async storeEnvelopeBody(input: StoreEnvelopeBodyInput): Promise<string> {
    const contentCommitment = await createObjectCommitment(input.bytes);
    const { stagedKey } = await this.store.stage({
      kind: "envelope-body",
      messageId: input.messageId,
      ownerAddress: input.ownerAddress,
      contentType: input.contentType,
      contentLength: input.bytes.length,
      contentCommitment,
      bytes: input.bytes,
    });
    const result = await this.store.finalize({
      stagedKey,
      ownerAddress: input.ownerAddress,
      expectedContentLength: input.bytes.length,
      expectedCommitment: contentCommitment,
      expectedContentType: input.contentType,
    });
    return result.key;
  }

  /**
   * Fetches and verifies a previously stored envelope body.
   */
  async getEnvelopeBody(key: string, ownerAddress: string): Promise<StoredObject | null> {
    return this.store.get(key, { ownerAddress });
  }

  /**
   * Stores an encrypted attachment chunk. The chunk key is derived from the
   * message id, the chunk content commitment, and the chunk index, so no
   * original filename is ever used.
   */
  async storeAttachmentChunk(input: StoreAttachmentChunkInput): Promise<string> {
    const contentCommitment = await createObjectCommitment(input.bytes);
    const { stagedKey } = await this.store.stage({
      kind: "attachment-chunk",
      messageId: input.messageId,
      ownerAddress: input.ownerAddress,
      contentType: input.contentType,
      contentLength: input.bytes.length,
      contentCommitment,
      bytes: input.bytes,
      chunkIndex: input.chunkIndex,
      totalChunks: input.totalChunks,
    });
    const result = await this.store.finalize({
      stagedKey,
      ownerAddress: input.ownerAddress,
      expectedContentLength: input.bytes.length,
      expectedCommitment: contentCommitment,
      expectedContentType: input.contentType,
    });
    return result.key;
  }

  /**
   * Fetches and verifies a previously stored attachment chunk.
   */
  async getAttachmentChunk(
    messageId: string,
    contentCommitment: string,
    chunkIndex: number,
    ownerAddress: string,
  ): Promise<StoredObject | null> {
    const key = attachmentChunkKey(messageId, contentCommitment, chunkIndex);
    return this.store.get(key, { ownerAddress });
  }

  /**
   * Computes the deterministic final key an envelope body will be stored under,
   * so callers can reference it before the object exists.
   */
  async previewEnvelopeBodyKey(messageId: string, bytes: Uint8Array): Promise<string> {
    const contentCommitment = await createObjectCommitment(bytes);
    return envelopeBodyKey(messageId, contentCommitment);
  }

  /**
   * Removes a stored object. Best-effort orphan cleanup for an abandoned
   * message.
   */
  async deleteObject(key: string): Promise<void> {
    await this.store.delete(key);
  }

  /**
   * Sweeps expired staged objects (partial uploads / abandoned objects) so they
   * cannot accumulate. Returns the number of objects removed.
   */
  async cleanupExpired(now?: Date): Promise<number> {
    return this.store.cleanupExpired(now);
  }

  /** Stable error type surfaced to relay callers. */
  static isObjectStoreError(error: unknown): error is ObjectStoreError {
    return error instanceof ObjectStoreError;
  }
}
