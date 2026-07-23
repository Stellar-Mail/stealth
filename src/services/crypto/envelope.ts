/**
 * Outbound message crypto envelope.
 *
 * Implements the encryption half of protocol/messages/envelope_spec.md.
 * The plaintext body is encrypted with AES-256-GCM in the browser; only the
 * ciphertext and a SHA-256 content commitment ever leave this module. The
 * plaintext is never returned, logged, or attached to thrown errors.
 *
 * Memory-optimized: operations are ordered to minimise peak allocation and
 * transient buffers are zeroed and released as early as practical. An optional
 * AbortSignal allows callers to release all references promptly on cancellation.
 */

import { clearSecret, digestHex, sharedPool, toBase64, toHex } from "./memory";
import { getCryptoTestVectors } from "./testing";
import { createCommitment } from "./commitment";
import { recordCryptoTelemetry, type CryptoResultCode } from "./telemetry";
import { canonicalizeAttachmentDescriptors } from "./attachment-metadata";

export interface EnvelopeAttachment {
  filename: string;
  content_type: string;
  size_bytes: number;
  content_hash: string;
  encryption_metadata?: EncryptionMetadata;
  ciphertext?: string;
}

export interface EncryptionMetadata {
  algorithm: string;
  nonce: string;
  mac: string;
  ephemeral_public_key?: string;
  recipient_key_id?: string;
  sender_key_id?: string;
}

export interface EnvelopePayload {
  version: "v1";
  sender: string;
  recipient: string;
  timestamp: string;
  encryption_metadata: EncryptionMetadata;
  content_commitment: string;
  attachments: EnvelopeAttachment[];
}

export interface SealedEnvelope {
  payload: EnvelopePayload;
  ciphertext: string;
}

export interface SealEnvelopeInput {
  sender: string;
  recipient: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content_type: string;
    size_bytes: number;
    data?: ArrayBuffer;
    content_hash?: string;
  }>;
  /** When aborted, all internal references are released and the promise rejects. */
  signal?: AbortSignal;
  recipientKeyId?: string;
  senderKeyId?: string;
}

const GCM_TAG_BYTES = 16;

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
  return toHex(new Uint8Array(digest));
}

import { canonicalize } from "./jcs";

/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 * Used so the signature in the wallet step is reproducible and strictly compliant.
 */
export function canonicalizePayload(value: unknown): string {
  return canonicalize(value);
}

/**
 * Encrypt the body and build the envelope payload.
 * Returns the payload plus base64 ciphertext. Never includes plaintext.
 *
 * ## Memory budget (body of N bytes, A attachments each ≤ M bytes)
 *
 * | Phase | Peak live bytes | Notes |
 * |-------|----------------|-------|
 * | Key gen | ~0 (CryptoKey, opaque) | |
 * | Body encrypt | N (plaintext) + N+16 (ciphertext) + 12 (IV) | IV from pool |
 * | After body encrypt | N+16 (ciphertext) | plaintext zeroed |
 * | Commitment | N+16 (ciphertext) + 32 (digest) | |
 * | Per-attachment encrypt | M + M+16 (att plaintext+ciphertext) | Sequential |
 * | After attachment encrypt | N+16 (body ciphertext) | att buffers released |
 * | Base64 body ciphertext | N+16 + ⌈(N+16)/3⌉×~4 (base64 strings) | ciphertext zeroed after |
 * | **Worst-case peak** | **≈ N + (N+16) + 12 + small** | **~2N + 28 bytes** |
 *
 * Without this optimisation the previous peak was ~3N + 48 (plaintext +
 * ciphertext + base64 intermediate binary string + hex helpers alive
 * simultaneously). The saving is ≈ N + 20 bytes for the body.
 */
export async function sealEnvelope(input: SealEnvelopeInput): Promise<SealedEnvelope> {
  const startTime = performance.now();
  let result: CryptoResultCode = "success";

  try {
    const body = input.body ?? "";
    if (!body.trim()) {
      throw new Error("Cannot seal an empty message body");
    }

    const signal = input.signal;
    const throwIfAborted = () => {
      signal?.throwIfAborted();
    };

    const { generateKey, getRandomValues, now } = getCryptoTestVectors();

    // --- Key generation (no plaintext allocated yet) ---
    throwIfAborted();
    const key = generateKey
      ? await generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
      : await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
          "encrypt",
          "decrypt",
        ]);

    // --- Pre-process attachments to get descriptors for AAD ---
    const attachmentsToProcess = input.attachments ?? [];
    const descriptors: Array<{
      filename: string;
      content_type: string;
      size_bytes: number;
      content_hash: string;
    }> = [];
    const preparedAttachments: Array<{
      filename: string;
      content_type: string;
      size_bytes: number;
      data?: ArrayBuffer;
      content_hash: string;
    }> = [];

    for (const attachment of attachmentsToProcess) {
      let hash: string;
      if (attachment.data) {
        // View into caller's ArrayBuffer — no copy for hashing.
        const dataBytes = new Uint8Array(attachment.data);
        hash = await digestHex(dataBytes);
        if (attachment.content_hash && hash !== attachment.content_hash) {
          throw new Error(
            `Mismatch between supplied bytes and content_hash for attachment ${attachment.filename}`,
          );
        }
      } else if (attachment.content_hash) {
        hash = attachment.content_hash;
      } else {
        throw new Error(
          `Attachment ${attachment.filename} must include either data bytes or a validated content_hash`,
        );
      }
      descriptors.push({
        filename: attachment.filename,
        content_type: attachment.content_type,
        size_bytes: attachment.size_bytes,
        content_hash: hash,
      });
      preparedAttachments.push({
        filename: attachment.filename,
        content_type: attachment.content_type,
        size_bytes: attachment.size_bytes,
        data: attachment.data,
        content_hash: hash,
      });
    }

    const aad = canonicalizeAttachmentDescriptors(descriptors);

    // --- Body encryption ---
    throwIfAborted();
    const ivBuf = sharedPool.acquire(12);
    const iv = new Uint8Array(ivBuf, 0, 12);
    if (getRandomValues) {
      getRandomValues(iv);
    } else {
      crypto.getRandomValues(iv);
    }

    const plaintext = new TextEncoder().encode(body);

    // crypto.subtle.encrypt returns a fresh ArrayBuffer; we cannot pre-fill
    // a pool buffer, but we manage the result lifecycle explicitly below.
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad as BufferSource },
        key,
        plaintext as BufferSource,
      ),
    );

    // Plaintext is no longer needed — zero it to release secret material early.
    clearSecret(plaintext);

    // AES-GCM appends a 16-byte auth tag to the end of the ciphertext.
    const tag = ciphertext.slice(ciphertext.length - GCM_TAG_BYTES);

    // --- Attachments (sequential, buffers freed per iteration) ---
    throwIfAborted();
    const attachments: EnvelopeAttachment[] = [];
    for (const attachment of preparedAttachments) {
      throwIfAborted();
      let encMetadata: EncryptionMetadata | undefined;
      let ciphertextStr: string | undefined;

      if (attachment.data) {
        const dataBytes = new Uint8Array(attachment.data);
        const attIv = sharedPool.acquire(12);
        const attIvView = new Uint8Array(attIv, 0, 12);
        crypto.getRandomValues(attIvView);

        const attCiphertext = new Uint8Array(
          await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: attIvView as BufferSource },
            key,
            dataBytes,
          ),
        );
        const attTag = attCiphertext.slice(attCiphertext.length - GCM_TAG_BYTES);

        encMetadata = {
          algorithm: "AES-256-GCM",
          nonce: toHex(attIvView),
          mac: toHex(attTag),
        };
        ciphertextStr = toBase64(attCiphertext);

        // Release attachment crypto buffers.
        clearSecret(attCiphertext);
        sharedPool.release(attIv);
      }
      attachments.push({
        filename: attachment.filename,
        content_type: attachment.content_type,
        size_bytes: attachment.size_bytes,
        content_hash: attachment.content_hash,
        ...(encMetadata ? { encryption_metadata: encMetadata } : {}),
        ...(ciphertextStr ? { ciphertext: ciphertextStr } : {}),
      });
    }

    // --- Final payload assembly ---
    throwIfAborted();

    // Compute the content commitment BEFORE base64-encoding so the binary
    // ciphertext can be released immediately after.
    const contentCommitment = await createCommitment(ciphertext);

    // Encode the ciphertext — the binary buffer is no longer needed afterwards.
    const ciphertextBase64 = toBase64(ciphertext);

    const nonceHex = toHex(iv);
    const macHex = toHex(tag);

    // Release body ciphertext buffer now that both commitment and base64 are done.
    clearSecret(ciphertext);
    sharedPool.release(ivBuf);

    const payload: EnvelopePayload = {
      version: "v1",
      sender: input.sender,
      recipient: input.recipient,
      timestamp: now ? now().toISOString() : new Date().toISOString(),
      encryption_metadata: {
        algorithm: "AES-256-GCM",
        nonce: nonceHex,
        mac: macHex,
        ...(input.recipientKeyId ? { recipient_key_id: input.recipientKeyId } : {}),
        ...(input.senderKeyId ? { sender_key_id: input.senderKeyId } : {}),
      },
      content_commitment: contentCommitment,
      attachments,
    };

    return { payload, ciphertext: ciphertextBase64 };
  } catch (error: unknown) {
    result = mapEnvelopeError(error);
    throw error;
  } finally {
    const durationMs = Math.max(1, Math.round(performance.now() - startTime));
    recordCryptoTelemetry({
      operation: "seal",
      suite: "AES-256-GCM",
      result,
      durationMs,
    });
  }
}

function mapEnvelopeError(error: unknown): CryptoResultCode {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") {
      switch (code) {
        case "crypto_parse_error":
          return "error_parse";
        case "crypto_validation_error":
          return "error_validation";
        case "crypto_algorithm_error":
          return "error_algorithm";
        case "crypto_key_error":
          return "error_key";
        case "crypto_signature_error":
          return "error_signature";
        case "crypto_commitment_error":
          return "error_commitment";
        case "crypto_decrypt_error":
          return "error_decrypt";
      }
    }
  }
  return "error_parse";
}
