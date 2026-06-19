import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { extractAttachments } from "./extractor";
import type { AttachmentMetadata } from "./extractor";

describe("Attachment Extractor (V1 Launch Tool)", () => {
  it("should return an empty array when no attachments are present", async () => {
    const result = await extractAttachments("From: test@stealth.xyz\n\nNo attachments here.");
    expect(result.success).toBe(true);
    expect(result.attachments).toHaveLength(0);
  });

  it("should return an empty array for a multipart message with no attachments", async () => {
    const payload = [
      'Content-Type: multipart/mixed; boundary="b"',
      "--b",
      "Content-Type: text/plain",
      "",
      "Body text.",
      "--b--",
    ].join("\r\n");
    const result = await extractAttachments(payload);
    expect(result.success).toBe(true);
    expect(result.attachments).toHaveLength(0);
  });

  it("should successfully extract standard attachment metadata from a multipart payload", async () => {
    const payload = await fs.readFile(
      path.join(__dirname, "__fixtures__", "mail-with-attachments.txt"),
      "utf-8",
    );
    const result = await extractAttachments(payload);

    expect(result.success).toBe(true);
    expect(result.attachments).toHaveLength(2);

    const report = result.attachments.find((a) => a.filename === "report.txt");
    expect(report).toBeDefined();
    expect(report?.contentType).toBe('text/plain; name="report.txt"');
    expect(report?.size).toBeGreaterThan(0);

    const image = result.attachments.find((a) => a.filename.startsWith("image_1_"));
    expect(image).toBeDefined();
    expect(image?.contentType).toBe('image/png; name="image(1).png"');
  });

  it("should correctly sanitize filenames to prevent path traversal", async () => {
    const payload = await fs.readFile(
      path.join(__dirname, "__fixtures__", "mail-with-attachments.txt"),
      "utf-8",
    );
    const result = await extractAttachments(payload);
    const image = result.attachments.find((a: AttachmentMetadata) =>
      a.contentType.includes("image/png"),
    );
    expect(image?.filename).toBe("image_1_.png");
  });
});
