import { describe, expect, it } from "vitest";

import {
  computeAttachmentCommitment,
  computeChunkHash,
  decryptChunk,
  encryptChunk,
  exportKeyHex,
  generateAttachmentKey,
  importKeyHex,
  sanitizeContentType,
  sanitizeFilename,
} from "../../../src/services/crypto/attachment-stream";

describe("attachment crypto & streaming helpers", () => {
  it("sanitizes filenames against path traversal, control chars, and XSS tags", () => {
    expect(sanitizeFilename("../../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Windows\\System32\\cmd.exe")).toBe("cmd.exe");
    expect(sanitizeFilename("<script>alert('xss')</script>report.pdf")).toBe(
      "alert('xss')report.pdf",
    );
    expect(sanitizeFilename("  hello\x00world.txt  ")).toBe("helloworld.txt");
    expect(sanitizeFilename("..")).toBe("unnamed_attachment");
    expect(sanitizeFilename("")).toBe("unnamed_attachment");
  });

  it("sanitizes dangerous content-types to application/octet-stream", () => {
    expect(sanitizeContentType("text/html", "index.html")).toBe("application/octet-stream");
    expect(sanitizeContentType("image/svg+xml", "logo.svg")).toBe("application/octet-stream");
    expect(sanitizeContentType("text/javascript", "app.js")).toBe("application/octet-stream");
    expect(sanitizeContentType("application/pdf", "doc.pdf")).toBe("application/pdf");
    expect(sanitizeContentType("image/png", "photo.png")).toBe("image/png");
    expect(sanitizeContentType("application/octet-stream", "doc.pdf")).toBe("application/pdf");
  });

  it("computes reproducible chunk SHA-256 hashes", async () => {
    const chunk = new TextEncoder().encode("hello stealth attachment chunk");
    const hash1 = await computeChunkHash(chunk);
    const hash2 = await computeChunkHash(chunk);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);

    const corruptChunk = new TextEncoder().encode("corrupt stealth attachment chunk");
    const hash3 = await computeChunkHash(corruptChunk);
    expect(hash3).not.toBe(hash1);
  });

  it("computes deterministic attachment commitments", async () => {
    const chunkHashes = ["a".repeat(64), "b".repeat(64)];
    const metadata = {
      filename: "test.pdf",
      contentType: "application/pdf",
      size: 1024,
    };
    const commitment1 = await computeAttachmentCommitment(chunkHashes, metadata);
    const commitment2 = await computeAttachmentCommitment(chunkHashes, metadata);
    expect(commitment1).toHaveLength(64);
    expect(commitment1).toBe(commitment2);
  });

  it("encrypts and decrypts chunks using AES-GCM", async () => {
    const key = await generateAttachmentKey();
    const hex = await exportKeyHex(key);
    const importedKey = await importKeyHex(hex);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode("Top secret attachment payload data");

    const ciphertext = await encryptChunk(plaintext, importedKey, iv);
    expect(ciphertext).not.toEqual(plaintext);

    const decrypted = await decryptChunk(ciphertext, importedKey, iv);
    expect(new TextDecoder().decode(decrypted)).toBe("Top secret attachment payload data");
  });
});
