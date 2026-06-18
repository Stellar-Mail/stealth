import { describe, it, expect } from "vitest";
import {
  categorizeMimeType,
  generateAttachmentId,
  formatFileSize,
  validateFile,
  calculateStats,
  extractAttachments,
  DEFAULT_CONFIG,
} from "./services";
import { MOCK_FILES, MOCK_RESULTS } from "./fixtures";
import type { ExtractionError } from "./types";

describe("AttachmentExtractor - Services", () => {
  describe("categorizeMimeType", () => {
    it("should categorize image MIME types", () => {
      expect(categorizeMimeType("image/jpeg")).toBe("image");
      expect(categorizeMimeType("image/png")).toBe("image");
      expect(categorizeMimeType("image/gif")).toBe("image");
    });

    it("should categorize document MIME types", () => {
      expect(categorizeMimeType("application/pdf")).toBe("document");
      expect(categorizeMimeType("application/msword")).toBe("document");
      expect(categorizeMimeType("text/plain")).toBe("document");
    });

    it("should categorize video MIME types", () => {
      expect(categorizeMimeType("video/mp4")).toBe("video");
      expect(categorizeMimeType("video/mpeg")).toBe("video");
    });

    it("should categorize audio MIME types", () => {
      expect(categorizeMimeType("audio/mpeg")).toBe("audio");
      expect(categorizeMimeType("audio/wav")).toBe("audio");
    });

    it("should categorize archive MIME types", () => {
      expect(categorizeMimeType("application/zip")).toBe("archive");
      expect(categorizeMimeType("application/x-rar-compressed")).toBe("archive");
    });

    it("should return 'other' for unknown types", () => {
      expect(categorizeMimeType("application/x-unknown")).toBe("other");
    });

    it("should respect custom category mapping", () => {
      const customMapping = { "application/custom": "image" as const };
      expect(categorizeMimeType("application/custom", customMapping)).toBe("image");
    });
  });

  describe("generateAttachmentId", () => {
    it("should generate unique IDs for same filename", () => {
      const id1 = generateAttachmentId("test.jpg", "image/jpeg");
      const id2 = generateAttachmentId("test.jpg", "image/jpeg");
      expect(id1).not.toBe(id2);
    });

    it("should include filename in ID", () => {
      const id = generateAttachmentId("myfile.pdf", "application/pdf");
      expect(id).toContain("myfile");
    });

    it("should sanitize filename special characters", () => {
      const id = generateAttachmentId("file (1).jpg", "image/jpeg");
      expect(id).not.toContain("(");
      expect(id).not.toContain(")");
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 B");
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1024 * 1024)).toBe("1 MB");
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
    });

    it("should handle fractional sizes", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB");
      expect(formatFileSize(1536 * 1024)).toBe("1.5 MB");
    });
  });

  describe("validateFile", () => {
    it("should accept valid files", () => {
      const result = validateFile(MOCK_FILES.image_jpeg, {});
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject oversized files", () => {
      const result = validateFile(MOCK_FILES.oversized, { maxFileSize: 10 * 1024 * 1024 });
      expect(result.valid).toBe(false);
      expect(result.error?.reason).toBe("file_too_large");
    });

    it("should reject unsupported MIME types", () => {
      const result = validateFile(MOCK_FILES.unsupported, {
        allowedMimeTypes: ["image/jpeg", "application/pdf"],
      });
      expect(result.valid).toBe(false);
      expect(result.error?.reason).toBe("unsupported_type");
    });

    it("should use default config when options empty", () => {
      const result = validateFile(MOCK_FILES.image_jpeg, {});
      expect(result.valid).toBe(true);
    });
  });

  describe("calculateStats", () => {
    it("should calculate correct statistics", () => {
      const mockResult = MOCK_RESULTS.successful();
      const stats = calculateStats(mockResult.attachments, mockResult.errors);

      expect(stats.successfulExtractions).toBe(3);
      expect(stats.failedExtractions).toBe(0);
      expect(stats.totalProcessed).toBe(3);
      expect(stats.byCategory.image).toBe(1);
      expect(stats.byCategory.document).toBe(1);
      expect(stats.byCategory.archive).toBe(1);
    });

    it("should calculate total size correctly", () => {
      const mockResult = MOCK_RESULTS.successful();
      const stats = calculateStats(mockResult.attachments, mockResult.errors);
      expect(stats.totalSize).toBe(7680000);
    });

    it("should count categories correctly with errors", () => {
      const mockResult = MOCK_RESULTS.withErrors();
      const stats = calculateStats(mockResult.attachments, mockResult.errors);

      expect(stats.successfulExtractions).toBe(1);
      expect(stats.failedExtractions).toBe(2);
      expect(stats.totalProcessed).toBe(3);
    });

    it("should initialize all categories to zero", () => {
      const stats = calculateStats([], []);
      expect(stats.byCategory.image).toBe(0);
      expect(stats.byCategory.document).toBe(0);
      expect(stats.byCategory.archive).toBe(0);
      expect(stats.byCategory.video).toBe(0);
      expect(stats.byCategory.audio).toBe(0);
      expect(stats.byCategory.other).toBe(0);
    });
  });

  describe("extractAttachments", () => {
    it("should extract valid files successfully", async () => {
      const files = [MOCK_FILES.image_jpeg, MOCK_FILES.document_pdf];
      const result = await extractAttachments(files);

      expect(result.success).toBe(true);
      expect(result.attachments.length).toBe(2);
      expect(result.errors.length).toBe(0);
    });

    it("should handle mixed valid and invalid files", async () => {
      const files = [MOCK_FILES.image_jpeg, MOCK_FILES.unsupported];
      const result = await extractAttachments(files, {
        allowedMimeTypes: ["image/jpeg"],
      });

      expect(result.success).toBe(false);
      expect(result.attachments.length).toBe(1);
      expect(result.errors.length).toBe(1);
    });

    it("should respect maxFileSize option", async () => {
      const result = await extractAttachments([MOCK_FILES.oversized], {
        maxFileSize: 10 * 1024 * 1024,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0].reason).toBe("file_too_large");
    });

    it("should handle empty file list", async () => {
      const result = await extractAttachments([]);
      expect(result.success).toBe(true);
      expect(result.attachments.length).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it("should categorize files correctly", async () => {
      const files = [
        MOCK_FILES.image_jpeg,
        MOCK_FILES.document_pdf,
        MOCK_FILES.archive_zip,
        MOCK_FILES.audio_mp3,
      ];
      const result = await extractAttachments(files);

      expect(result.stats.byCategory.image).toBe(1);
      expect(result.stats.byCategory.document).toBe(1);
      expect(result.stats.byCategory.archive).toBe(1);
      expect(result.stats.byCategory.audio).toBe(1);
    });
  });

  describe("Configuration", () => {
    it("should have reasonable defaults", () => {
      expect(DEFAULT_CONFIG.maxFileSize).toBe(50 * 1024 * 1024);
      expect(DEFAULT_CONFIG.allowedMimeTypes.length).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.extractMetadata).toBe(true);
      expect(DEFAULT_CONFIG.generateChecksum).toBe(false);
    });

    it("should include common file types", () => {
      expect(DEFAULT_CONFIG.allowedMimeTypes).toContain("image/jpeg");
      expect(DEFAULT_CONFIG.allowedMimeTypes).toContain("application/pdf");
      expect(DEFAULT_CONFIG.allowedMimeTypes).toContain("application/zip");
      expect(DEFAULT_CONFIG.allowedMimeTypes).toContain("video/mp4");
      expect(DEFAULT_CONFIG.allowedMimeTypes).toContain("audio/mpeg");
    });
  });
});
