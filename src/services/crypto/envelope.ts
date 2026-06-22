/**
 * Outbound message crypto envelope.
 *
 * Implements the encryption half of protocol/messages/envelope_spec.md.
 * The plaintext body is encrypted with AES-256-GCM in the browser; only the
 * ciphertext and a SHA-256 content commitment ever leave this module. The
 * plaintext is never returned, logged, or attached to thrown errors.
 */

export interface EnvelopeAttachment {
  filename: string;
  content_type: string;
  size_bytes: number;
  content_hash: string;
}

export interface EncryptionMetadata {
  algorithm: string;
  nonce: string;
  mac: string;
  ephemeral_public_key?: string;
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
  }>;
}

const GCM_TAG_BYTES = 16;

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
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

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
  return toHex(new Uint8Array(digest));
}

/**
 * RFC 8785-style canonical JSON: object keys sorted, no insignificant
 * whitespace. Used so the signature in the wallet step is reproducible.
 */
export function canonicalizePayload(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((item) => canonicalizePayload(item)).join(",") + "]";
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => JSON.stringify(key) + ":" + canonicalizePayload(record[key]));
  return "{" + entries.join(",") + "}";
}

/**
 * Encrypt the body and build the envelope payload.
 * Returns the payload plus base64 ciphertext. Never includes plaintext.
 */
export async function sealEnvelope(input: SealEnvelopeInput): Promise<SealedEnvelope> {
  const body = input.body ?? "";
  if (!body.trim()) {
    throw new Error("Cannot seal an empty message body");
  }

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(body);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );

  // AES-GCM appends a 16-byte auth tag to the end of the ciphertext.
  const tag = ciphertext.slice(ciphertext.length - GCM_TAG_BYTES);

  const attachments: EnvelopeAttachment[] = [];
  for (const attachment of input.attachments ?? []) {
    const hash = attachment.data
      ? await sha256Hex(new Uint8Array(attachment.data))
      : await sha256Hex(
          new TextEncoder().encode(attachment.filename + ":" + attachment.size_bytes),
        );
    attachments.push({
      filename: attachment.filename,
      content_type: attachment.content_type,
      size_bytes: attachment.size_bytes,
      content_hash: hash,
    });
  }

  const payload: EnvelopePayload = {
    version: "v1",
    sender: input.sender,
    recipient: input.recipient,
    timestamp: new Date().toISOString(),
    encryption_metadata: {
      algorithm: "AES-256-GCM",
      nonce: toHex(iv),
      mac: toHex(tag),
    },
    content_commitment: await sha256Hex(ciphertext),
    attachments,
  };

  return { payload, ciphertext: toBase64(ciphertext) };
}
