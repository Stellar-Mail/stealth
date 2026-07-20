import type { PdfSummaryInput, PdfSummaryExecutionSettings } from "./execution";

export const validSettings: PdfSummaryExecutionSettings = {
  length: "medium",
  style: "bullet-points",
  includeKeywords: true,
  language: "en",
};

export const successfulInput: PdfSummaryInput = {
  fileBuffer: Buffer.from("Sample PDF content for testing"),
  fileName: "test-document.pdf",
  fileSize: 1024,
  settings: validSettings,
};

export const emptyBufferInput: PdfSummaryInput = {
  fileBuffer: Buffer.from(""),
  fileName: "empty.pdf",
  fileSize: 0,
  settings: validSettings,
};

export const largeFileInput: PdfSummaryInput = {
  fileBuffer: Buffer.from("x".repeat(50 * 1024 * 1024)),
  fileName: "large.pdf",
  fileSize: 50 * 1024 * 1024,
  settings: validSettings,
};

export const invalidSettingsInput: PdfSummaryInput = {
  fileBuffer: Buffer.from("content"),
  fileName: "test.pdf",
  fileSize: 100,
  settings: {
    length: "invalid" as any,
    style: "paragraph",
    includeKeywords: false,
    language: "",
  },
};

export const unsupportedFormatInput: PdfSummaryInput = {
  fileBuffer: Buffer.from("content"),
  fileName: "document.docx",
  fileSize: 500,
  settings: validSettings,
};

export const shortSettings: PdfSummaryExecutionSettings = {
  ...validSettings,
  length: "short",
  style: "paragraph",
  includeKeywords: false,
};

export const longBulletSettings: PdfSummaryExecutionSettings = {
  ...validSettings,
  length: "long",
  style: "bullet-points",
  includeKeywords: true,
};
