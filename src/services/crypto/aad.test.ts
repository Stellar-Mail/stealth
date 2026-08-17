/**
 * Tests for AAD encoding and envelope routing metadata authentication (#1687).
 *
 * Verifies that:
 * - encodeAad is deterministic (same input → same bytes)
 * - encodeAad is sensitive (any field change → different bytes)
 * - Field-by-field tampering of protected routing metadata causes decryption
 *   failure in the full seal → tamper → open integration flow.
 */

import { describe, expect, it } from "vitest";
import { encodeAad, type ProtectedHeader } from "./aad";
import { sealEnvelope, type SealEnvelopeInput } from "./envelope";
import { openEnvelope, WrappedKeyProvider } from "./open-envelope";
import { generateRecipientKeyPair } from "./key-wrap";

const BASE_HEADER: ProtectedHeader = {
  version: "v1",
  sender: "GD5KD2SB3U6K7BMTQGZ6QLM45TV4VJLJ4A7OQBKLMNOPQRSTUVWXYZ",
  recipient: "GCVANL2B3U6K7BMTQGZ6QLM45TV4VJLJ4A7OQBKLMNOPQRSTUVWXYZ",
  timestamp: "2026-07-26T12:00:00.000Z",
  attachments: [
    {
      filename: "report.pdf",
      content_type: "application/pdf",
      size_bytes: 1048576,
      content_hash: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
    },
  ],
};

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  Determinism and sensitivity                                       */
/* ------------------------------------------------------------------ */

describe("encodeAad determinism", () => {
  it("produces identical output for identical input", () => {
    const a = encodeAad(BASE_HEADER);
    const b = encodeAad(BASE_HEADER);
    expect(bytesEqual(a, b)).toBe(true);
  });

  it("produces identical output for same content across calls", () => {
    const results = Array.from({ length: 10 }, () => encodeAad(BASE_HEADER));
    for (let i = 1; i < results.length; i++) {
      expect(bytesEqual(results[0], results[i])).toBe(true);
    }
  });
});

describe("encodeAad field sensitivity", () => {
  it("differs when version changes", () => {
    const modified = { ...BASE_HEADER, version: "v2" };
    expect(bytesEqual(encodeAad(BASE_HEADER), encodeAad(modified))).toBe(false);
  });

  it("differs when sender changes", () => {
    const modified = {
      ...BASE_HEADER,
      sender: "GDIFFERENTADDRESS1234567890123456789012345678901234567890123",
    };
    expect(bytesEqual(encodeAad(BASE_HEADER), encodeAad(modified))).toBe(false);
  });

  it("differs when recipient changes", () => {
    const modified = {
      ...BASE_HEADER,
      recipient: "GDIFFERENTADDRESS1234567890123456789012345678901234567890123",
    };
    expect(bytesEqual(encodeAad(BASE_HEADER), encodeAad(modified))).toBe(false);
  });

  it("differs when timestamp changes", () => {
    const modified = { ...BASE_HEADER, timestamp: "2026-07-27T12:00:00.000Z" };
    expect(bytesEqual(encodeAad(BASE_HEADER), encodeAad(modified))).toBe(false);
  });

  it("differs when attachment count changes", () => {
    const modified = { ...BASE_HEADER, attachments: [] };
    expect(bytesEqual(encodeAad(BASE_HEADER), encodeAad(modified))).toBe(false);
  });

  it("differs when attachment filename changes", () => {
    const modified = {
      ...BASE_HEADER,
      attachments: [{ ...BASE_HEADER.attachments[0], filename: "different.pdf" }],
    };
    expect(bytesEqual(encodeAad(BASE_HEADER), encodeAad(modified))).toBe(false);
  });
});

describe("encodeAad edge cases", () => {
  it("accepts empty attachments array", () => {
    const header: ProtectedHeader = {
      ...BASE_HEADER,
      attachments: [],
    };
    const result = encodeAad(header);
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles multi-byte Unicode in sender and recipient", () => {
    const header: ProtectedHeader = {
      ...BASE_HEADER,
      sender: "alice@举例.测试",
      recipient: "bob@ пример.тест",
    };
    const result = encodeAad(header);
    expect(result.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Integration: field-by-field tamper detection                      */
/* ------------------------------------------------------------------ */

async function sealAndOpen(): Promise<void> {
  const recipient = await generateRecipientKeyPair();
  const input: SealEnvelopeInput = {
    sender: "alice@example.com",
    recipient: "bob@example.com",
    body: "This is a secure test message.",
    recipientPublicKeys: [recipient.publicKeySpkiBase64],
  };

  const sealed = await sealEnvelope(input);
  const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);
  const opened = await openEnvelope(
    { payload: sealed.payload, ciphertext: sealed.ciphertext },
    keyProvider,
  );

  expect(opened.body).toBe("This is a secure test message.");
  expect(opened.sender).toBe("alice@example.com");
  expect(opened.recipient).toBe("bob@example.com");
}

describe("AAD integration — field-by-field tampering", () => {
  it("seal and open succeeds without tampering", async () => {
    await sealAndOpen();
  });

  it("tampered version causes decryption failure", async () => {
    const recipient = await generateRecipientKeyPair();
    const sealed = await sealEnvelope({
      sender: "alice@test.com",
      recipient: "bob@test.com",
      body: "test",
      recipientPublicKeys: [recipient.publicKeySpkiBase64],
    });

    (sealed.payload as unknown as Record<string, unknown>).version = "v999";

    const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);
    await expect(
      openEnvelope({ payload: sealed.payload, ciphertext: sealed.ciphertext }, keyProvider),
    ).rejects.toThrow();
  });

  it("tampered sender causes decryption failure", async () => {
    const recipient = await generateRecipientKeyPair();
    const sealed = await sealEnvelope({
      sender: "alice@test.com",
      recipient: "bob@test.com",
      body: "test",
      recipientPublicKeys: [recipient.publicKeySpkiBase64],
    });

    sealed.payload.sender = "eve@evil.com";

    const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);
    await expect(
      openEnvelope({ payload: sealed.payload, ciphertext: sealed.ciphertext }, keyProvider),
    ).rejects.toThrow();
  });

  it("tampered recipient causes decryption failure", async () => {
    const recipient = await generateRecipientKeyPair();
    const sealed = await sealEnvelope({
      sender: "alice@test.com",
      recipient: "bob@test.com",
      body: "test",
      recipientPublicKeys: [recipient.publicKeySpkiBase64],
    });

    sealed.payload.recipient = "mallory@evil.com";

    const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);
    await expect(
      openEnvelope({ payload: sealed.payload, ciphertext: sealed.ciphertext }, keyProvider),
    ).rejects.toThrow();
  });

  it("tampered timestamp causes decryption failure", async () => {
    const recipient = await generateRecipientKeyPair();
    const sealed = await sealEnvelope({
      sender: "alice@test.com",
      recipient: "bob@test.com",
      body: "test",
      recipientPublicKeys: [recipient.publicKeySpkiBase64],
    });

    sealed.payload.timestamp = "2025-01-01T00:00:00.000Z";

    const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);
    await expect(
      openEnvelope({ payload: sealed.payload, ciphertext: sealed.ciphertext }, keyProvider),
    ).rejects.toThrow();
  });

  it("removed attachment causes decryption failure", async () => {
    const recipient = await generateRecipientKeyPair();
    const attachment = new Uint8Array([1, 2, 3, 4]).buffer;
    const sealed = await sealEnvelope({
      sender: "alice@test.com",
      recipient: "bob@test.com",
      body: "test with attachment",
      attachments: [
        {
          filename: "data.bin",
          content_type: "application/octet-stream",
          size_bytes: 4,
          data: attachment,
        },
      ],
      recipientPublicKeys: [recipient.publicKeySpkiBase64],
    });

    // Clear the attachment — the AAD won't match
    sealed.payload.attachments = [];

    const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);
    await expect(
      openEnvelope({ payload: sealed.payload, ciphertext: sealed.ciphertext }, keyProvider),
    ).rejects.toThrow();
  });

  it("tampered attachment filename causes decryption failure", async () => {
    const recipient = await generateRecipientKeyPair();
    const attachment = new Uint8Array([1, 2, 3, 4]).buffer;
    const sealed = await sealEnvelope({
      sender: "alice@test.com",
      recipient: "bob@test.com",
      body: "test",
      attachments: [
        {
          filename: "safe.doc",
          content_type: "application/msword",
          size_bytes: 4,
          data: attachment,
        },
      ],
      recipientPublicKeys: [recipient.publicKeySpkiBase64],
    });

    sealed.payload.attachments[0].filename = "malicious.exe";

    const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);
    await expect(
      openEnvelope({ payload: sealed.payload, ciphertext: sealed.ciphertext }, keyProvider),
    ).rejects.toThrow();
  });
});
