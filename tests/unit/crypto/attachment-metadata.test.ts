import { describe, expect, it } from "vitest";
import { sealEnvelope } from "../../../src/services/crypto/envelope";
import { openEnvelope, type KeyProvider } from "../../../src/services/crypto/open-envelope";
import { sanitizeFilenameForDisplay } from "../../../src/services/crypto/attachment-metadata";
import { getCryptoTestVectors } from "../../../src/services/crypto/testing";

describe("Attachment Metadata Authentication & Sanitation", () => {
  const sender = "alice@example.com";
  const recipient = "bob@example.com";
  const body = "Confidential body text";

  const attachment1 = {
    filename: "invoice.pdf",
    content_type: "application/pdf",
    size_bytes: 1024,
    data: new TextEncoder().encode("Dummy pdf content").buffer,
  };

  const attachment2 = {
    filename: "notes.txt",
    content_type: "text/plain",
    size_bytes: 512,
    data: new TextEncoder().encode("Dummy txt content").buffer,
  };

  const setupMockKey = async () => {
    const vectors = getCryptoTestVectors();
    const mockKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    vectors.generateKey = async () => mockKey;
    const keyProvider: KeyProvider = {
      async resolveKey() {
        return mockKey;
      },
    };
    return {
      mockKey,
      keyProvider,
      cleanUp: () => {
        vectors.generateKey = undefined;
      },
    };
  };

  it("successfully seals and opens an envelope with authenticated attachments", async () => {
    const { keyProvider, cleanUp } = await setupMockKey();
    try {
      const sealed = await sealEnvelope({
        sender,
        recipient,
        body,
        attachments: [attachment1, attachment2],
      });

      const opened = await openEnvelope(sealed, keyProvider);
      expect(opened.body).toBe(body);
      expect(opened.attachments).toHaveLength(2);
      expect(opened.attachments[0].filename).toBe("invoice.pdf");
      expect(opened.attachments[1].filename).toBe("notes.txt");
    } finally {
      cleanUp();
    }
  });

  it("fails verification if an attachment filename is mutated", async () => {
    const { keyProvider, cleanUp } = await setupMockKey();
    try {
      const sealed = await sealEnvelope({
        sender,
        recipient,
        body,
        attachments: [attachment1, attachment2],
      });

      // Mutate filename
      (sealed.payload.attachments as any)[0].filename = "malicious.exe";

      await expect(openEnvelope(sealed, keyProvider)).rejects.toThrow(
        "decryption failed (wrong key or tampered)",
      );
    } finally {
      cleanUp();
    }
  });

  it("fails verification if an attachment MIME type is mutated", async () => {
    const { keyProvider, cleanUp } = await setupMockKey();
    try {
      const sealed = await sealEnvelope({
        sender,
        recipient,
        body,
        attachments: [attachment1, attachment2],
      });

      // Mutate MIME type
      (sealed.payload.attachments as any)[0].content_type = "text/html";

      await expect(openEnvelope(sealed, keyProvider)).rejects.toThrow(
        "decryption failed (wrong key or tampered)",
      );
    } finally {
      cleanUp();
    }
  });

  it("fails verification if attachments are reordered", async () => {
    const { keyProvider, cleanUp } = await setupMockKey();
    try {
      const sealed = await sealEnvelope({
        sender,
        recipient,
        body,
        attachments: [attachment1, attachment2],
      });

      // Swap attachments ordering
      const temp = sealed.payload.attachments[0];
      sealed.payload.attachments[0] = sealed.payload.attachments[1];
      sealed.payload.attachments[1] = temp;

      await expect(openEnvelope(sealed, keyProvider)).rejects.toThrow(
        "decryption failed (wrong key or tampered)",
      );
    } finally {
      cleanUp();
    }
  });

  it("correctly sanitizes directory-traversal filename for display but retains original in payload", async () => {
    const { keyProvider, cleanUp } = await setupMockKey();
    try {
      const traversalAttachment = {
        filename: "../../../etc/passwd",
        content_type: "text/plain",
        size_bytes: 12,
        data: new TextEncoder().encode("etc passwd content").buffer,
      };

      const sealed = await sealEnvelope({
        sender,
        recipient,
        body,
        attachments: [traversalAttachment],
      });

      const opened = await openEnvelope(sealed, keyProvider);

      // Verify that cryptographic identity preserves the exact (possibly unsafe) filename
      expect(opened.attachments[0].filename).toBe("../../../etc/passwd");

      // Verify that sanitization correctly normalizes it for display
      const displayFilename = sanitizeFilenameForDisplay(opened.attachments[0].filename);
      expect(displayFilename).toBe("passwd");
    } finally {
      cleanUp();
    }
  });
});
