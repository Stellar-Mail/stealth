/**
 * Attachment download client service (BETA-031 / #1938).
 *
 * Provides authenticated download of encrypted attachment chunks from the
 * relay API, with manifest verification and decryption via
 * `decryptAttachmentStream`.
 */

import {
  decryptAttachmentStream,
  type AttachmentStreamManifest,
  type EncryptedChunkFrame,
} from "@/services/crypto/attachment-stream";

export interface DownloadAttachmentInput {
  messageId: string;
  contentHash: string;
  totalChunks: number;
  encryptionKey: CryptoKey;
  manifest: AttachmentStreamManifest;
  ownerAddress: string;
  signal?: AbortSignal;
  onProgress?: (progress: { chunksReceived: number; totalChunks: number; percent: number }) => void;
  baseUrl?: string;
}

export interface DownloadAttachmentResult {
  blob: Blob;
  chunks: number;
}

export class AttachmentDownloadError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "AttachmentDownloadError";
    this.code = code;
    this.retryable = retryable;
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new AttachmentDownloadError("cancelled", "Download was cancelled");
    }
    try {
      const response = await fetch(url, { ...init, signal });
      if (response.ok) return response;

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitMs = retryAfter ? Number.parseInt(retryAfter, 10) : 1000 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, waitMs * 1000));
        continue;
      }

      if (response.status >= 500 && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
        continue;
      }

      const body = await response.json().catch(() => null);
      const message = body?.error?.message ?? `HTTP ${response.status}`;
      throw new AttachmentDownloadError("server_error", message);
    } catch (error) {
      if (error instanceof AttachmentDownloadError) throw error;
      if (signal?.aborted) {
        throw new AttachmentDownloadError("cancelled", "Download was cancelled");
      }
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  }
  throw new AttachmentDownloadError(
    "network_error",
    lastError?.message ?? "Download failed after retries",
    true,
  );
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export async function downloadAttachment(
  input: DownloadAttachmentInput,
): Promise<DownloadAttachmentResult> {
  const {
    messageId,
    contentHash,
    totalChunks,
    encryptionKey,
    manifest,
    ownerAddress,
    signal,
    onProgress,
    baseUrl = "/api/v1/attachments",
  } = input;

  const frames: EncryptedChunkFrame[] = [];

  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) {
      throw new AttachmentDownloadError("cancelled", "Download was cancelled");
    }

    const params = new URLSearchParams({
      message_id: messageId,
      content_hash: contentHash,
      chunk_index: String(i),
    });

    const data = await fetchWithRetry(
      `${baseUrl}/download?${params}`,
      {
        headers: { "x-stealth-address": ownerAddress },
      },
      signal,
    ).then((r) => r.json());

    const chunkData = data.data;
    const rawBytes = new Uint8Array(chunkData.chunk_data);

    // Wire format: nonce (12 bytes) || ciphertext || mac (16 bytes)
    const NONCE_LEN = 12;
    const MAC_LEN = 16;
    const nonceBytes = rawBytes.slice(0, NONCE_LEN);
    const macBytes = rawBytes.slice(rawBytes.length - MAC_LEN);
    const cipherBytes = rawBytes.slice(NONCE_LEN, rawBytes.length - MAC_LEN);

    let nonceHex = "";
    for (const b of nonceBytes) {
      nonceHex += b.toString(16).padStart(2, "0");
    }
    let macHex = "";
    for (const b of macBytes) {
      macHex += b.toString(16).padStart(2, "0");
    }

    let ciphertextB64 = "";
    let binary = "";
    for (const b of cipherBytes) {
      binary += String.fromCharCode(b);
    }
    ciphertextB64 = btoa(binary);

    frames.push({
      sequence: i,
      final: i === totalChunks - 1,
      nonce: nonceHex,
      ciphertext: ciphertextB64,
      mac: macHex,
    });

    onProgress?.({
      chunksReceived: i + 1,
      totalChunks,
      percent: Math.round(((i + 1) / totalChunks) * 100),
    });
  }

  const plaintextChunks: Uint8Array[] = [];
  const frameStream = (async function* () {
    for (const frame of frames) {
      yield frame;
    }
  })();

  for await (const plaintext of decryptAttachmentStream(encryptionKey, manifest, frameStream, {
    signal,
  })) {
    plaintextChunks.push(plaintext);
  }

  let totalLength = 0;
  for (const chunk of plaintextChunks) {
    totalLength += chunk.length;
  }
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of plaintextChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return {
    blob: new Blob([combined]),
    chunks: totalChunks,
  };
}
