/**
 * Attachment Extractor - Core Services
 * Pure functions for extraction logic
 */

import type {
  Attachment,
  AttachmentMetadata,
  ExtractionError,
  ExtractionOptions,
  ExtractionResult,
  ExtractionStats,
  FileCategory,
  ExtractorConfig,
} from "./types";

/**
 * Default configuration for attachment extractor
 */
export const DEFAULT_CONFIG: ExtractorConfig = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: [
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    // Archives
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/gzip",
    // Video
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    // Audio
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/flac",
  ],
  extractMetadata: true,
  generateChecksum: false,
  categoryMapping: {},
};

/**
 * Map MIME type to file category
 */
export function categorizeMimeType(
  mimeType: string,
  customMapping?: Record<string, FileCategory>,
): FileCategory {
  const mapping = customMapping || DEFAULT_CONFIG.categoryMapping;

  // Check custom mapping first
  if (mapping[mimeType]) {
    return mapping[mimeType];
  }

  // Default categorization
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("excel") ||
    mimeType.includes("powerpoint") ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  ) {
    return "document";
  }
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("7z") ||
    mimeType.includes("gzip") ||
    mimeType.includes("archive")
  ) {
    return "archive";
  }

  return "other";
}

/**
 * Generate unique ID for attachment
 */
export function generateAttachmentId(filename: string, mimeType: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${filename.replace(/\W/g, "_")}_${mimeType.replace(/\//g, "_")}_${timestamp}_${random}`;
}

/**
 * Calculate file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Validate file against extraction options
 */
export function validateFile(
  file: File,
  options: ExtractionOptions,
): { valid: boolean; error?: ExtractionError } {
  const maxSize = options.maxFileSize || DEFAULT_CONFIG.maxFileSize;
  const allowedTypes = options.allowedMimeTypes || DEFAULT_CONFIG.allowedMimeTypes;

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: {
        filename: file.name,
        mimeType: file.type,
        reason: "file_too_large",
        message: `File exceeds maximum size of ${formatFileSize(maxSize)}`,
      },
    };
  }

  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: {
        filename: file.name,
        mimeType: file.type,
        reason: "unsupported_type",
        message: `File type ${file.type} is not supported`,
      },
    };
  }

  return { valid: true };
}

/**
 * Extract metadata from file (basic implementation)
 * In real implementation, would use proper binary parsing
 */
export async function extractMetadata(file: File): Promise<AttachmentMetadata> {
  const metadata: AttachmentMetadata = {};

  // Basic metadata extraction
  if (file.type.startsWith("image/")) {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      metadata.width = img.width;
      metadata.height = img.height;
      URL.revokeObjectURL(url);
    } catch (error) {
      // Silently fail - metadata is optional
    }
  }

  // Add file timestamps
  metadata.createdDate = new Date(file.lastModified);
  metadata.modifiedDate = new Date(file.lastModified);

  return metadata;
}

/**
 * Calculate checksum (simplified - uses SHA256 if available, otherwise fallback)
 */
export async function calculateChecksum(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    // Fallback to simple checksum
    return String(
      `${file.size}_${file.lastModified}_${file.type}`.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a; // Convert to 32bit integer
      }, 0),
    );
  }
}

/**
 * Process a single file into attachment
 */
export async function processFile(
  file: File,
  options: ExtractionOptions,
): Promise<Attachment | ExtractionError> {
  // Validate file
  const validation = validateFile(file, options);
  if (!validation.valid) {
    return validation.error!;
  }

  const category = categorizeMimeType(file.type, options.categoryMapping);
  const id = generateAttachmentId(file.name, file.type);

  let metadata: AttachmentMetadata | undefined;
  if (options.extractMetadata) {
    metadata = await extractMetadata(file);
  }

  let checksum: string | undefined;
  if (options.generateChecksum) {
    checksum = await calculateChecksum(file);
  }

  return {
    id,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    category,
    extractedAt: new Date(),
    checksum,
    metadata,
  };
}

/**
 * Calculate extraction statistics
 */
export function calculateStats(
  attachments: Attachment[],
  errors: ExtractionError[],
): ExtractionStats {
  const categoryCount: Record<string, number> = {};

  // Initialize all categories
  ["image", "document", "archive", "video", "audio", "other"].forEach((cat) => {
    categoryCount[cat] = 0;
  });

  // Count by category
  attachments.forEach((att) => {
    categoryCount[att.category]++;
  });

  const totalSize = attachments.reduce((sum, att) => sum + att.size, 0);

  return {
    totalProcessed: attachments.length + errors.length,
    successfulExtractions: attachments.length,
    failedExtractions: errors.length,
    totalSize,
    byCategory: categoryCount as Record<string, number>,
  };
}

/**
 * Main extraction function
 * Processes multiple files and returns results
 */
export async function extractAttachments(
  files: File[],
  options: ExtractionOptions = {},
): Promise<ExtractionResult> {
  const attachments: Attachment[] = [];
  const errors: ExtractionError[] = [];

  // Process each file
  for (const file of files) {
    try {
      const result = await processFile(file, options);

      if ("reason" in result) {
        // It's an error
        errors.push(result as ExtractionError);
      } else {
        // It's an attachment
        attachments.push(result as Attachment);
      }
    } catch (error) {
      errors.push({
        filename: file.name,
        mimeType: file.type,
        reason: "unknown",
        message: error instanceof Error ? error.message : "Unknown error during extraction",
      });
    }
  }

  const stats = calculateStats(attachments, errors);

  return {
    success: errors.length === 0,
    attachments,
    errors,
    stats,
  };
}
