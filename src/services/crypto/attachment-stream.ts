/**
 * Streaming attachment crypto (#1700).
 *
 * Encrypts large attachments as a sequence of AES-256-GCM chunks instead of
 * buffering the whole file in memory. Each chunk's nonce and authentication
 * tag are bound to its sequence number and final-chunk flag (via GCM
 * additional data), so a decryptor that enforces a strictly increasing
 * expected sequence rejects reordered, duplicated, or substituted chunks
 * before it ever has to trust their contents. On the wire, each chunk's GCM
 * tag is carried separately from its ciphertext (as `mac`, matching the
 * ciphertext-excludes-tag convention this crypto module has settled on)
 * rather than left appended, so the representation is unambiguous.
 *
 * A running SHA-256 chain over every chunk's (nonce, ciphertext, tag, final
 * flag) is authenticated at the end with an HMAC-SHA256 manifest MAC, keyed
 * by an HKDF (RFC 5869) subkey derived from the attachment key — never the
 * AES-GCM key itself. This catches truncation: a decryptor that stops early
 * has an incomplete chain and the manifest MAC will not verify.
 *
 * Self-contained: this module defines its own minimal error type and byte
 * codecs rather than depending on sibling crypto modules, so it stays
 * independently mergeable alongside other in-flight crypto-folder work.
 */

export const ATTACHMENT_STREAM_ALGORITHM = "AES-256-GCM-STREAM-v1";

export const DEFAULT_CHUNK_SIZE_BYTES = 1 * 1024 * 1024; // 1 MiB
export const MIN_CHUNK_SIZE_BYTES = 1024; // 1 KiB
export const MAX_CHUNK_SIZE_BYTES = 16 * 1024 * 1024; // 16 MiB

const NONCE_BYTES = 12;
const SEQUENCE_XOR_OFFSET = NONCE_BYTES - 4;
const MAX_CHUNK_SEQUENCE = 2 ** 32 - 1;
const GCM_TAG_BYTES = 16;
const MANIFEST_KEY_CONTEXT = new TextEncoder().encode("stealth-attachment-manifest-v1");

export class AttachmentStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentStreamError";
  }
}

export interface EncryptedChunkFrame {
  sequence: number;
  final: boolean;
  nonce: string; // hex
  ciphertext: string; // base64, GCM auth tag excluded
  mac: string; // hex, 16-byte GCM auth tag
}

export interface AttachmentStreamManifest {
  algorithm: string;
  chunk_size: number;
  chunk_count: number;
  total_size_bytes: number;
  base_nonce: string; // hex
  manifest_mac: string; // hex, HMAC-SHA256
}

export interface AttachmentStreamOptions {
  signal?: AbortSignal;
}

export interface EncryptAttachmentStreamOptions extends AttachmentStreamOptions {
  chunkSizeBytes?: number;
}

export interface EncryptedAttachmentStream {
  chunks: AsyncGenerator<EncryptedChunkFrame, void, void>;
  manifest: Promise<AttachmentStreamManifest>;
}

type ByteSource = AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>;

// TypeScript's DOM lib types Web Crypto's BufferSource as ArrayBufferView<ArrayBuffer>,
// which the bare `Uint8Array` alias (= Uint8Array<ArrayBufferLike>) doesn't satisfy. Any
// byte array that flows into crypto.subtle.* is typed as Bytes to stay concrete.
type Bytes = Uint8Array<ArrayBuffer>;

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

function fromHex(hex: string): Bytes {
  if (hex.length % 2 !== 0) {
    throw new AttachmentStreamError("Malformed hex string");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.substr(i * 2, 2), 16);
    if (Number.isNaN(byte)) {
      throw new AttachmentStreamError("Malformed hex string");
    }
    out[i] = byte;
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Bytes {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AttachmentStreamError("Attachment stream operation was cancelled");
  }
}

function validateChunkSize(chunkSizeBytes: number | undefined): number {
  const chunkSize = chunkSizeBytes ?? DEFAULT_CHUNK_SIZE_BYTES;
  if (
    !Number.isInteger(chunkSize) ||
    chunkSize < MIN_CHUNK_SIZE_BYTES ||
    chunkSize > MAX_CHUNK_SIZE_BYTES
  ) {
    throw new AttachmentStreamError(
      `chunkSizeBytes must be an integer between ${MIN_CHUNK_SIZE_BYTES} and ${MAX_CHUNK_SIZE_BYTES}, received ${chunkSizeBytes}`,
    );
  }
  return chunkSize;
}

function validateManifestShape(manifest: AttachmentStreamManifest): void {
  if (manifest.algorithm !== ATTACHMENT_STREAM_ALGORITHM) {
    throw new AttachmentStreamError(
      `Unsupported attachment stream algorithm: ${manifest.algorithm}`,
    );
  }
  if (!/^[a-f0-9]{24}$/.test(manifest.base_nonce)) {
    throw new AttachmentStreamError("Malformed manifest base_nonce");
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.manifest_mac)) {
    throw new AttachmentStreamError("Malformed manifest manifest_mac");
  }
  if (!Number.isInteger(manifest.chunk_count) || manifest.chunk_count < 0) {
    throw new AttachmentStreamError("Malformed manifest chunk_count");
  }
  if (!Number.isInteger(manifest.total_size_bytes) || manifest.total_size_bytes < 0) {
    throw new AttachmentStreamError("Malformed manifest total_size_bytes");
  }
  if (!Number.isInteger(manifest.chunk_size) || manifest.chunk_size < MIN_CHUNK_SIZE_BYTES) {
    throw new AttachmentStreamError("Malformed manifest chunk_size");
  }
}

/** Per-chunk nonce = base nonce with its last 4 bytes XORed with the sequence number. */
function deriveChunkNonce(baseNonce: Uint8Array, sequence: number): Bytes {
  const nonce = new Uint8Array(baseNonce);
  const view = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
  const counter = view.getUint32(SEQUENCE_XOR_OFFSET, false);
  view.setUint32(SEQUENCE_XOR_OFFSET, (counter ^ sequence) >>> 0, false);
  return nonce;
}

function encodeChunkAad(sequence: number, final: boolean): Bytes {
  const aad = new Uint8Array(5);
  new DataView(aad.buffer).setUint32(0, sequence, false);
  aad[4] = final ? 1 : 0;
  return aad;
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Bytes> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new Uint8Array(data)));
}

/**
 * Derives the manifest HMAC key from the attachment's raw AES key via a
 * single-block HKDF (RFC 5869): extract with the stream's base nonce as
 * salt, expand with a fixed purpose label. 32 bytes of output fits in one
 * HKDF-Expand block, so the general multi-block loop isn't needed here.
 */
async function deriveManifestKey(rawKey: Uint8Array, baseNonce: Uint8Array): Promise<CryptoKey> {
  const prk = await hmacSha256(baseNonce, rawKey);
  const info = new Uint8Array(MANIFEST_KEY_CONTEXT.length + 1);
  info.set(MANIFEST_KEY_CONTEXT, 0);
  info[MANIFEST_KEY_CONTEXT.length] = 1;
  const okm = await hmacSha256(prk, info);
  return crypto.subtle.importKey("raw", okm, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function manifestMacMessage(
  chainHash: Uint8Array,
  meta: Pick<AttachmentStreamManifest, "chunk_size" | "chunk_count" | "total_size_bytes">,
): Bytes {
  const out = new Uint8Array(chainHash.length + 16);
  out.set(chainHash, 0);
  const view = new DataView(out.buffer);
  view.setUint32(chainHash.length, meta.chunk_size, false);
  view.setUint32(chainHash.length + 4, meta.chunk_count, false);
  view.setBigUint64(chainHash.length + 8, BigInt(meta.total_size_bytes), false);
  return out;
}

async function extendChain(
  chainHash: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  final: boolean,
): Promise<Bytes> {
  const material = new Uint8Array(chainHash.length + nonce.length + ciphertext.length + 1);
  let offset = 0;
  material.set(chainHash, offset);
  offset += chainHash.length;
  material.set(nonce, offset);
  offset += nonce.length;
  material.set(ciphertext, offset);
  offset += ciphertext.length;
  material[offset] = final ? 1 : 0;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", material));
}

function concatBytes(segments: Uint8Array[], length: number): Bytes {
  const out = new Uint8Array(length);
  let offset = 0;
  for (const segment of segments) {
    out.set(segment, offset);
    offset += segment.length;
  }
  return out;
}

function toAsyncIterator(source: ByteSource): AsyncIterator<Uint8Array> {
  const maybeIterable = source as AsyncIterable<Uint8Array>;
  if (typeof maybeIterable[Symbol.asyncIterator] === "function") {
    return maybeIterable[Symbol.asyncIterator]();
  }

  const reader = (source as ReadableStream<Uint8Array>).getReader();
  return {
    async next(): Promise<IteratorResult<Uint8Array>> {
      const { value, done } = await reader.read();
      if (done) {
        return { value: undefined, done: true };
      }
      return { value, done: false };
    },
    async return(): Promise<IteratorResult<Uint8Array>> {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
      return { value: undefined, done: true };
    },
  };
}

/** Generates a fresh, extractable AES-256-GCM key for a single attachment. */
export async function generateAttachmentKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

/**
 * Encrypts a byte source as a stream of authenticated chunks, never
 * buffering more than one chunk of plaintext at a time. The returned
 * `manifest` promise settles once `chunks` has been fully drained (or
 * rejects if encryption fails or is cancelled).
 *
 * Cancellation: abort `options.signal`, or stop iterating `chunks`
 * (`break` out of a `for await` loop or call `chunks.return()`) — either
 * way the underlying source is released.
 */
export function encryptAttachmentStream(
  key: CryptoKey,
  source: ByteSource,
  options: EncryptAttachmentStreamOptions = {},
): EncryptedAttachmentStream {
  const chunkSize = validateChunkSize(options.chunkSizeBytes);
  const signal = options.signal;

  let settleManifest!: (manifest: AttachmentStreamManifest) => void;
  let failManifest!: (error: unknown) => void;
  const manifest = new Promise<AttachmentStreamManifest>((resolve, reject) => {
    settleManifest = resolve;
    failManifest = reject;
  });

  async function* run(): AsyncGenerator<EncryptedChunkFrame, void, void> {
    const iterator = toAsyncIterator(source);
    try {
      const baseNonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
      const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
      let chainHash = new Uint8Array(await crypto.subtle.digest("SHA-256", baseNonce));

      let sequence = 0;
      let totalBytes = 0;
      let segments: Uint8Array[] = [];
      let segmentsLength = 0;
      let sourceExhausted = false;

      for (;;) {
        while (segmentsLength <= chunkSize && !sourceExhausted) {
          checkAbort(signal);
          const { value, done } = await iterator.next();
          if (done) {
            sourceExhausted = true;
            break;
          }
          if (value.length === 0) {
            continue;
          }
          segments.push(value);
          segmentsLength += value.length;
        }

        checkAbort(signal);
        const isFinal = segmentsLength <= chunkSize;
        const buffer = concatBytes(segments, segmentsLength);
        const plaintext: Bytes = isFinal ? buffer : new Uint8Array(buffer.subarray(0, chunkSize));

        if (sequence > MAX_CHUNK_SEQUENCE) {
          throw new AttachmentStreamError("Attachment exceeds the maximum supported chunk count");
        }

        const nonce = deriveChunkNonce(baseNonce, sequence);
        const aad = encodeChunkAad(sequence, isFinal);
        const sealed = new Uint8Array(
          await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: nonce, additionalData: aad },
            key,
            plaintext,
          ),
        );
        const ciphertext = sealed.subarray(0, sealed.length - GCM_TAG_BYTES);
        const tag = sealed.subarray(sealed.length - GCM_TAG_BYTES);
        chainHash = await extendChain(chainHash, nonce, sealed, isFinal);
        totalBytes += plaintext.length;

        const frame: EncryptedChunkFrame = {
          sequence,
          final: isFinal,
          nonce: toHex(nonce),
          ciphertext: toBase64(ciphertext),
          mac: toHex(tag),
        };
        sequence += 1;
        yield frame;

        if (isFinal) {
          const manifestKey = await deriveManifestKey(rawKey, baseNonce);
          const message = manifestMacMessage(chainHash, {
            chunk_size: chunkSize,
            chunk_count: sequence,
            total_size_bytes: totalBytes,
          });
          const mac = new Uint8Array(await crypto.subtle.sign("HMAC", manifestKey, message));
          settleManifest({
            algorithm: ATTACHMENT_STREAM_ALGORITHM,
            chunk_size: chunkSize,
            chunk_count: sequence,
            total_size_bytes: totalBytes,
            base_nonce: toHex(baseNonce),
            manifest_mac: toHex(mac),
          });
          return;
        }

        const remainder = buffer.subarray(chunkSize);
        segments = remainder.length > 0 ? [remainder] : [];
        segmentsLength = remainder.length;
      }
    } catch (error) {
      failManifest(error);
      throw error;
    } finally {
      await iterator.return?.().catch(() => undefined);
    }
  }

  return { chunks: run(), manifest };
}

/**
 * Decrypts a stream of chunk frames against a previously produced manifest,
 * yielding plaintext incrementally. Enforces a strictly increasing expected
 * sequence, verifies each chunk's derived nonce and GCM tag, and — once the
 * final chunk arrives — verifies the manifest MAC over the accumulated
 * chunk chain. Any reordering, duplication, substitution, corruption, or
 * truncation causes an `AttachmentStreamError` to be thrown.
 */
export async function* decryptAttachmentStream(
  key: CryptoKey,
  manifest: AttachmentStreamManifest,
  chunks: AsyncIterable<EncryptedChunkFrame>,
  options: AttachmentStreamOptions = {},
): AsyncGenerator<Uint8Array, void, void> {
  validateManifestShape(manifest);
  const signal = options.signal;
  const baseNonce = fromHex(manifest.base_nonce);
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));

  const iterator = chunks[Symbol.asyncIterator]();
  let chainHash = new Uint8Array(await crypto.subtle.digest("SHA-256", baseNonce));
  let expectedSequence = 0;
  let totalBytes = 0;
  let sawFinal = false;

  try {
    for (;;) {
      checkAbort(signal);
      const { value: frame, done } = await iterator.next();
      if (done) {
        break;
      }
      if (sawFinal) {
        throw new AttachmentStreamError("Received a chunk after the final chunk");
      }
      if (frame.sequence !== expectedSequence) {
        throw new AttachmentStreamError(
          `Chunk sequence mismatch: expected ${expectedSequence}, received ${frame.sequence} (reordered, duplicated, or dropped chunk)`,
        );
      }

      const nonce = deriveChunkNonce(baseNonce, frame.sequence);
      if (frame.nonce !== toHex(nonce)) {
        throw new AttachmentStreamError(`Chunk ${frame.sequence} has an unexpected nonce`);
      }

      const cipherBytes = fromBase64(frame.ciphertext);
      const tagBytes = fromHex(frame.mac);
      if (tagBytes.length !== GCM_TAG_BYTES) {
        throw new AttachmentStreamError(`Chunk ${frame.sequence} has a malformed auth tag`);
      }
      const sealed = new Uint8Array(cipherBytes.length + tagBytes.length);
      sealed.set(cipherBytes, 0);
      sealed.set(tagBytes, cipherBytes.length);

      const aad = encodeChunkAad(frame.sequence, frame.final);
      let plaintext: Uint8Array;
      try {
        plaintext = new Uint8Array(
          await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: nonce, additionalData: aad },
            key,
            sealed,
          ),
        );
      } catch {
        throw new AttachmentStreamError(
          `Chunk ${frame.sequence} failed authentication (corrupted or substituted)`,
        );
      }

      chainHash = await extendChain(chainHash, nonce, sealed, frame.final);
      totalBytes += plaintext.length;
      expectedSequence += 1;
      if (frame.final) {
        sawFinal = true;
      }

      yield plaintext;
    }
  } finally {
    await iterator.return?.().catch(() => undefined);
  }

  if (!sawFinal) {
    throw new AttachmentStreamError(
      "Attachment stream ended before a final chunk was received (truncated)",
    );
  }
  if (expectedSequence !== manifest.chunk_count) {
    throw new AttachmentStreamError(
      `Attachment chunk count mismatch: manifest declares ${manifest.chunk_count}, received ${expectedSequence}`,
    );
  }
  if (totalBytes !== manifest.total_size_bytes) {
    throw new AttachmentStreamError(
      `Attachment size mismatch: manifest declares ${manifest.total_size_bytes} bytes, received ${totalBytes}`,
    );
  }

  const manifestKey = await deriveManifestKey(rawKey, baseNonce);
  const message = manifestMacMessage(chainHash, manifest);
  const valid = await crypto.subtle.verify(
    "HMAC",
    manifestKey,
    fromHex(manifest.manifest_mac),
    message,
  );
  if (!valid) {
    throw new AttachmentStreamError(
      "Attachment manifest authentication failed (stream tampered or incomplete)",
    );
  }
}
