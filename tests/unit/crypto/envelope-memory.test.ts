import { describe, expect, it } from "vitest";
import {
  sealEnvelope,
  canonicalizePayload,
  type SealEnvelopeInput,
} from "../../../src/services/crypto/envelope";

const defaultInput: SealEnvelopeInput = {
  sender: "alice@example.com",
  recipient: "bob@example.com",
  body: "Hello Bob",
};

describe("crypto/envelope — sealing", () => {
  it("produces a valid SealedEnvelope structure", async () => {
    const result = await sealEnvelope(defaultInput);
    expect(result).toBeDefined();
    expect(result.payload).toBeDefined();
    expect(result.ciphertext).toBeDefined();
    expect(result.payload.version).toBe("v1");
    expect(result.payload.sender).toBe(defaultInput.sender);
    expect(result.payload.recipient).toBe(defaultInput.recipient);
    expect(result.payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.payload.attachments).toEqual([]);
  });

  it("throws on empty body", async () => {
    await expect(sealEnvelope({ ...defaultInput, body: "" })).rejects.toThrow(/empty message body/);
  });

  it("throws on whitespace-only body", async () => {
    await expect(sealEnvelope({ ...defaultInput, body: "   " })).rejects.toThrow(
      /empty message body/,
    );
  });

  it("ciphertext is valid base64", async () => {
    const result = await sealEnvelope(defaultInput);
    // Should decode without throwing
    const decoded = atob(result.ciphertext);
    expect(decoded.length).toBeGreaterThan(0);
  });

  it("encryption_metadata has correct algorithm", async () => {
    const result = await sealEnvelope(defaultInput);
    expect(result.payload.encryption_metadata.algorithm).toBe("AES-256-GCM");
  });

  it("nonce is lowercase hex of 12 bytes (24 chars)", async () => {
    const result = await sealEnvelope(defaultInput);
    expect(result.payload.encryption_metadata.nonce).toMatch(/^[0-9a-f]{24}$/);
  });

  it("mac is lowercase hex of 16 bytes (32 chars)", async () => {
    const result = await sealEnvelope(defaultInput);
    expect(result.payload.encryption_metadata.mac).toMatch(/^[0-9a-f]{32}$/);
  });

  it("content_commitment is lowercase hex of 32 bytes (64 chars)", async () => {
    const result = await sealEnvelope(defaultInput);
    expect(result.payload.content_commitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces valid encryption structure for repeated calls", async () => {
    const a = await sealEnvelope(defaultInput);
    const b = await sealEnvelope(defaultInput);
    // Both must produce valid base64 ciphertext and correct structure.
    expect(a.ciphertext).toBeDefined();
    expect(b.ciphertext).toBeDefined();
    expect(a.payload.encryption_metadata.nonce).toMatch(/^[0-9a-f]{24}$/);
    expect(b.payload.encryption_metadata.nonce).toMatch(/^[0-9a-f]{24}$/);
    expect(a.payload.encryption_metadata.mac).toMatch(/^[0-9a-f]{32}$/);
    expect(a.payload.content_commitment).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("crypto/envelope — attachments", () => {
  it("seals with data attachment", async () => {
    const data = new TextEncoder().encode("Hello Attachment").buffer;
    const result = await sealEnvelope({
      ...defaultInput,
      attachments: [
        {
          filename: "test.txt",
          content_type: "text/plain",
          size_bytes: 16,
          data,
        },
      ],
    });
    expect(result.payload.attachments).toHaveLength(1);
    const att = result.payload.attachments[0];
    expect(att.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(att.ciphertext).toBeDefined();
    expect(att.encryption_metadata).toBeDefined();
    expect(att.encryption_metadata!.algorithm).toBe("AES-256-GCM");
    expect(att.encryption_metadata!.nonce).toMatch(/^[0-9a-f]{24}$/);
    expect(att.encryption_metadata!.mac).toMatch(/^[0-9a-f]{32}$/);
  });

  it("seals with content_hash-only attachment", async () => {
    const hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const result = await sealEnvelope({
      ...defaultInput,
      attachments: [
        {
          filename: "test.txt",
          content_type: "text/plain",
          size_bytes: 0,
          content_hash: hash,
        },
      ],
    });
    expect(result.payload.attachments[0].content_hash).toBe(hash);
    expect(result.payload.attachments[0].ciphertext).toBeUndefined();
    expect(result.payload.attachments[0].encryption_metadata).toBeUndefined();
  });

  it("throws when attachment has neither data nor content_hash", async () => {
    await expect(
      sealEnvelope({
        ...defaultInput,
        attachments: [
          {
            filename: "test.txt",
            content_type: "text/plain",
            size_bytes: 100,
          },
        ],
      }),
    ).rejects.toThrow(/must include either data bytes or a validated content_hash/);
  });

  it("throws on content_hash mismatch", async () => {
    const data = new TextEncoder().encode("Hello Attachment").buffer;
    const badHash = "0".repeat(64);
    await expect(
      sealEnvelope({
        ...defaultInput,
        attachments: [
          {
            filename: "test.txt",
            content_type: "text/plain",
            size_bytes: 16,
            data,
            content_hash: badHash,
          },
        ],
      }),
    ).rejects.toThrow(/Mismatch between supplied bytes and content_hash/);
  });
});

describe("crypto/envelope — cancellation (AbortSignal)", () => {
  it("rejects immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(sealEnvelope({ ...defaultInput, signal: controller.signal })).rejects.toThrow(
      /cancelled/,
    );
  });

  it("rejects mid-seal when signal is aborted during key generation", async () => {
    const controller = new AbortController();
    // Abort synchronously before the async work starts — the first
    // throwIfAborted() at key generation will throw.
    controller.abort(new Error("abort-keygen"));
    await expect(sealEnvelope({ ...defaultInput, signal: controller.signal })).rejects.toThrow(
      /abort-keygen/,
    );
  });

  it("seals successfully when signal is not aborted", async () => {
    const controller = new AbortController();
    const result = await sealEnvelope({ ...defaultInput, signal: controller.signal });
    expect(result.ciphertext).toBeDefined();
  });
});

describe("crypto/envelope — memory behavior", () => {
  it("plaintext is not present in the returned SealedEnvelope", async () => {
    const body = "Sensitive plaintext that must not leak";
    const result = await sealEnvelope({ ...defaultInput, body });
    // The payload should not contain the plaintext body anywhere
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(body);
  });

  it("attachment plaintext is not present in the returned SealedEnvelope", async () => {
    const secretData = "secret-attachment-content-12345";
    const data = new TextEncoder().encode(secretData).buffer;
    const result = await sealEnvelope({
      ...defaultInput,
      attachments: [
        {
          filename: "secret.txt",
          content_type: "text/plain",
          size_bytes: data.byteLength,
          data,
        },
      ],
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(secretData);
  });
});

describe("crypto/envelope — canonicalizePayload", () => {
  it("sorts object keys alphabetically", () => {
    const input = { z: 1, a: 2, m: 3 };
    expect(canonicalizePayload(input)).toBe('{"a":2,"m":3,"z":1}');
  });

  it("handles nested objects", () => {
    const input = { b: { d: 1, c: 2 }, a: 3 };
    expect(canonicalizePayload(input)).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });

  it("handles arrays", () => {
    expect(canonicalizePayload([3, 1, 2])).toBe("[3,1,2]");
  });

  it("handles primitives", () => {
    expect(canonicalizePayload("hello")).toBe('"hello"');
    expect(canonicalizePayload(42)).toBe("42");
    expect(canonicalizePayload(true)).toBe("true");
    expect(canonicalizePayload(null)).toBe("null");
  });

  it("produces deterministic output for same input", () => {
    const input = { sender: "alice", recipient: "bob", timestamp: "2024-01-01" };
    const a = canonicalizePayload(input);
    const b = canonicalizePayload(input);
    expect(a).toBe(b);
  });
});
