import { describe, expect, it } from "vitest";
import { sealEnvelope } from "./envelope";

describe("services/crypto/envelope", () => {
  const defaultInput = {
    sender: "alice@example.com",
    recipient: "bob@example.com",
    body: "Hello Bob",
  };

  it("should successfully seal an envelope without attachments", async () => {
    const result = await sealEnvelope(defaultInput);
    expect(result).toBeDefined();
    expect(result.payload.attachments).toHaveLength(0);
  });

  it("should successfully seal an envelope with an attachment providing data", async () => {
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
    expect(result.payload.attachments[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.payload.attachments[0].ciphertext).toBeDefined();
    expect(result.payload.attachments[0].encryption_metadata).toBeDefined();
    expect(result.payload.attachments[0].encryption_metadata?.algorithm).toBe("AES-256-GCM");
    expect(result.payload.attachments[0].encryption_metadata?.nonce).toMatch(/^[0-9a-f]{24}$/);
    expect(result.payload.attachments[0].encryption_metadata?.mac).toMatch(/^[0-9a-f]{32}$/);
  });

  it("should successfully seal an envelope with an attachment providing only content_hash", async () => {
    const dummyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // sha256 empty string
    const result = await sealEnvelope({
      ...defaultInput,
      attachments: [
        {
          filename: "test.txt",
          content_type: "text/plain",
          size_bytes: 0,
          content_hash: dummyHash,
        },
      ],
    });
    expect(result.payload.attachments).toHaveLength(1);
    expect(result.payload.attachments[0].content_hash).toBe(dummyHash);
    expect(result.payload.attachments[0].ciphertext).toBeUndefined();
    expect(result.payload.attachments[0].encryption_metadata).toBeUndefined();
  });

  it("should fail when neither data nor content_hash is provided for an attachment", async () => {
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

  it("should fail when both data and content_hash are provided but they mismatch", async () => {
    const data = new TextEncoder().encode("Hello Attachment").buffer;
    const invalidHash = "invalidhash00000000000000000000000000000000000000000000000000000";
    await expect(
      sealEnvelope({
        ...defaultInput,
        attachments: [
          {
            filename: "test.txt",
            content_type: "text/plain",
            size_bytes: 16,
            data,
            content_hash: invalidHash,
          },
        ],
      }),
    ).rejects.toThrow(/Mismatch between supplied bytes and content_hash/);
  });

  it("should succeed when both data and content_hash are provided and they match", async () => {
    const data = new TextEncoder().encode("Hello Attachment").buffer;
    // Hash of "Hello Attachment"
    const validHash = "c7a829ba2c1bb8283e3391b4501a1c8f1d3c1de5bf5cb5cff0207ed2a15c82ff";

    const result = await sealEnvelope({
      ...defaultInput,
      attachments: [
        {
          filename: "test.txt",
          content_type: "text/plain",
          size_bytes: 16,
          data,
          content_hash: validHash,
        },
      ],
    });
    expect(result.payload.attachments).toHaveLength(1);
    expect(result.payload.attachments[0].content_hash).toBe(validHash);
    expect(result.payload.attachments[0].ciphertext).toBeDefined();
    expect(result.payload.attachments[0].encryption_metadata).toBeDefined();
  });
});
