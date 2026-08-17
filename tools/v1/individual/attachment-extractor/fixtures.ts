/**
 * Attachment Extractor - Test Fixtures
 * Mock data for testing without external dependencies
 */

import type { Attachment, ExtractionError, ExtractionResult } from "./types";

/**
 * Mock files for testing
 */
export const MOCK_FILES = {
  image_jpeg: new File(["fake image data"], "sample.jpg", { type: "image/jpeg" }),
  image_png: new File(["fake png data"], "screenshot.png", { type: "image/png" }),
  document_pdf: new File(["fake pdf data"], "report.pdf", { type: "application/pdf" }),
  document_word: new File(["fake word data"], "document.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }),
  archive_zip: new File(["fake zip data"], "archive.zip", { type: "application/zip" }),
  audio_mp3: new File(["fake audio data"], "song.mp3", { type: "audio/mpeg" }),
  video_mp4: new File(["fake video data"], "video.mp4", { type: "video/mp4" }),
  oversized: new File(
    ["x".repeat(60 * 1024 * 1024)], // 60MB
    "toolarge.bin",
    { type: "application/octet-stream" },
  ),
  unsupported: new File(["fake data"], "unknown.xyz", { type: "application/x-unknown" }),
};

/**
 * Mock extraction results
 */
export const MOCK_RESULTS = {
  /**
   * Successful extraction with mixed file types
   */
  successful: (): ExtractionResult => ({
    success: true,
    attachments: [
      {
        id: "image_1",
        name: "sample.jpg",
        mimeType: "image/jpeg",
        size: 2048000,
        category: "image",
        extractedAt: new Date("2026-06-18T10:00:00Z"),
        metadata: {
          width: 1920,
          height: 1080,
          createdDate: new Date("2026-06-18T09:00:00Z"),
        },
      },
      {
        id: "document_1",
        name: "report.pdf",
        mimeType: "application/pdf",
        size: 512000,
        category: "document",
        extractedAt: new Date("2026-06-18T10:01:00Z"),
        metadata: {
          pages: 12,
          createdDate: new Date("2026-06-17T15:00:00Z"),
        },
      },
      {
        id: "archive_1",
        name: "files.zip",
        mimeType: "application/zip",
        size: 5120000,
        category: "archive",
        extractedAt: new Date("2026-06-18T10:02:00Z"),
      },
    ],
    errors: [],
    stats: {
      totalProcessed: 3,
      successfulExtractions: 3,
      failedExtractions: 0,
      totalSize: 7680000,
      byCategory: {
        image: 1,
        document: 1,
        archive: 1,
        video: 0,
        audio: 0,
        other: 0,
      },
    },
  }),

  /**
   * Extraction with errors
   */
  withErrors: (): ExtractionResult => ({
    success: false,
    attachments: [
      {
        id: "image_1",
        name: "valid.jpg",
        mimeType: "image/jpeg",
        size: 1024000,
        category: "image",
        extractedAt: new Date("2026-06-18T10:00:00Z"),
      },
    ],
    errors: [
      {
        filename: "toolarge.zip",
        mimeType: "application/zip",
        reason: "file_too_large",
        message: "File exceeds maximum size of 50 MB",
      },
      {
        filename: "unknown.xyz",
        mimeType: "application/x-unknown",
        reason: "unsupported_type",
        message: "File type application/x-unknown is not supported",
      },
    ],
    stats: {
      totalProcessed: 3,
      successfulExtractions: 1,
      failedExtractions: 2,
      totalSize: 1024000,
      byCategory: {
        image: 1,
        document: 0,
        archive: 0,
        video: 0,
        audio: 0,
        other: 0,
      },
    },
  }),

  /**
   * Empty extraction (no files)
   */
  empty: (): ExtractionResult => ({
    success: true,
    attachments: [],
    errors: [],
    stats: {
      totalProcessed: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      totalSize: 0,
      byCategory: {
        image: 0,
        document: 0,
        archive: 0,
        video: 0,
        audio: 0,
        other: 0,
      },
    },
  }),
};

/**
 * Mock attachment for UI testing
 */
export const MOCK_ATTACHMENTS: Attachment[] = [
  {
    id: "att_1",
    name: "presentation.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    size: 3072000,
    category: "document",
    extractedAt: new Date("2026-06-18T10:00:00Z"),
    metadata: {
      pages: 15,
      createdDate: new Date("2026-06-18T09:00:00Z"),
    },
  },
  {
    id: "att_2",
    name: "vacation.mp4",
    mimeType: "video/mp4",
    size: 102400000,
    category: "video",
    extractedAt: new Date("2026-06-18T10:05:00Z"),
    metadata: {
      duration: 180,
      width: 1920,
      height: 1080,
    },
  },
  {
    id: "att_3",
    name: "photos.zip",
    mimeType: "application/zip",
    size: 51200000,
    category: "archive",
    extractedAt: new Date("2026-06-18T10:10:00Z"),
  },
  {
    id: "att_4",
    name: "spreadsheet.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 1024000,
    category: "document",
    extractedAt: new Date("2026-06-18T10:15:00Z"),
    metadata: {
      pages: 3,
    },
  },
  {
    id: "att_5",
    name: "podcast.mp3",
    mimeType: "audio/mpeg",
    size: 20480000,
    category: "audio",
    extractedAt: new Date("2026-06-18T10:20:00Z"),
    metadata: {
      duration: 3600,
    },
  },
];

/**
 * Mock errors for error state testing
 */
export const MOCK_ERRORS: ExtractionError[] = [
  {
    filename: "toolarge.iso",
    mimeType: "application/x-iso9660-image",
    reason: "file_too_large",
    message: "File exceeds maximum size of 50 MB",
  },
  {
    filename: "malicious.exe",
    mimeType: "application/x-msdownload",
    reason: "unsupported_type",
    message: "File type application/x-msdownload is not supported",
  },
  {
    filename: "corrupted.pdf",
    mimeType: "application/pdf",
    reason: "invalid_data",
    message: "PDF file appears to be corrupted",
  },
];
