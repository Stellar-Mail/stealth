/**
 * Team Task Board from Emails - Attachment Validator
 *
 * Validates attachments for safety and size constraints
 * Requirement 3: Attachment Safety Constraints
 */

import type { EmailAttachment, ValidationResult, ValidationError } from "../types";

// ============================================================================
// Constants
// ============================================================================

const LIMITS = {
  MAX_SINGLE_SIZE: 25 * 1024 * 1024, // 25 MB
  MAX_TOTAL_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_FILENAME_LENGTH: 255,
  MAX_ARCHIVE_FILES: 100,
  MAX_COMPRESSION_RATIO: 100, // 100:1
};

// Executable file extensions
const EXECUTABLE_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".msi",
  ".app",
  ".deb",
  ".rpm",
  ".com",
  ".scr",
  ".vbs",
  ".js",
  ".jar",
  ".apk",
]);

// Archive extensions
const ARCHIVE_EXTENSIONS = new Set([".zip", ".tar", ".gz", ".rar", ".7z", ".bz2", ".xz"]);

// Allowlisted MIME types for application/octet-stream
const ALLOWLISTED_OCTETS = new Set([
  // Add specific allowlisted types if needed
]);

// MIME type to extension mappings
const MIME_TO_EXT: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/svg+xml": [".svg"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  "application/json": [".json"],
  "application/xml": [".xml"],
  "application/zip": [".zip"],
  "application/x-tar": [".tar"],
  "application/gzip": [".gz"],
};

// ============================================================================
// Attachment Validator
// ============================================================================

export class AttachmentValidator {
  /**
   * Validates a single attachment
   */
  static validateAttachment(attachment: EmailAttachment): ValidationResult<EmailAttachment> {
    const errors: ValidationError[] = [];

    // Check size
    this.validateSize(attachment.size, errors);

    // Check filename
    this.validateFilename(attachment.filename, errors);

    // Check for executables
    this.checkExecutableExtension(attachment.filename, errors);

    // Check for double extensions
    this.checkDoubleExtension(attachment.filename, errors);

    // Check MIME type consistency
    this.validateMimeType(attachment.filename, attachment.mimeType, errors);

    return {
      isValid: errors.length === 0,
      value: errors.length === 0 ? attachment : undefined,
      errors,
    };
  }

  /**
   * Validates multiple attachments (total size check)
   */
  static validateAttachments(attachments: EmailAttachment[]): ValidationResult<EmailAttachment[]> {
    const errors: ValidationError[] = [];

    // Calculate total size
    const totalSize = attachments.reduce((sum, att) => sum + att.size, 0);

    if (totalSize > LIMITS.MAX_TOTAL_SIZE) {
      errors.push({
        field: "attachments",
        code: "TOTAL_SIZE_EXCEEDED",
        message: `Total attachment size (${this.formatBytes(totalSize)}) exceeds limit (${this.formatBytes(LIMITS.MAX_TOTAL_SIZE)})`,
        severity: "error",
      });
    }

    // Validate each attachment
    attachments.forEach((attachment, index) => {
      const result = this.validateAttachment(attachment);
      result.errors.forEach((error) => {
        errors.push({
          ...error,
          field: `attachments[${index}].${error.field}`,
        });
      });
    });

    return {
      isValid: errors.length === 0,
      value: errors.length === 0 ? attachments : undefined,
      errors,
    };
  }

  /**
   * Validates attachment size
   */
  private static validateSize(size: number, errors: ValidationError[]): void {
    if (size > LIMITS.MAX_SINGLE_SIZE) {
      errors.push({
        field: "size",
        code: "SIZE_EXCEEDED",
        message: `Attachment size (${this.formatBytes(size)}) exceeds limit (${this.formatBytes(LIMITS.MAX_SINGLE_SIZE)})`,
        severity: "error",
      });
    }

    if (size <= 0) {
      errors.push({
        field: "size",
        code: "INVALID_SIZE",
        message: "Attachment size must be greater than 0",
        severity: "error",
      });
    }
  }

  /**
   * Validates filename
   */
  private static validateFilename(filename: string, errors: ValidationError[]): void {
    // Check length
    if (filename.length > LIMITS.MAX_FILENAME_LENGTH) {
      errors.push({
        field: "filename",
        code: "FILENAME_TOO_LONG",
        message: `Filename length (${filename.length}) exceeds limit (${LIMITS.MAX_FILENAME_LENGTH})`,
        severity: "error",
      });
    }

    // Check for null bytes
    if (filename.includes("\x00")) {
      errors.push({
        field: "filename",
        code: "NULL_BYTE_IN_FILENAME",
        message: "Filename contains null bytes",
        severity: "error",
      });
    }

    // Check for path separators
    if (filename.includes("/") || filename.includes("\\")) {
      errors.push({
        field: "filename",
        code: "PATH_SEPARATOR_IN_FILENAME",
        message: "Filename contains path separators",
        severity: "error",
      });
    }

    // Check for empty filename
    if (!filename.trim()) {
      errors.push({
        field: "filename",
        code: "EMPTY_FILENAME",
        message: "Filename is empty",
        severity: "error",
      });
    }
  }

  /**
   * Checks for executable extensions
   */
  private static checkExecutableExtension(filename: string, errors: ValidationError[]): void {
    const ext = this.getFileExtension(filename);
    if (EXECUTABLE_EXTENSIONS.has(ext)) {
      errors.push({
        field: "filename",
        code: "EXECUTABLE_EXTENSION",
        message: `Executable file extension '${ext}' is not allowed`,
        severity: "error",
      });
    }
  }

  /**
   * Checks for double extensions (e.g., file.pdf.exe)
   */
  private static checkDoubleExtension(filename: string, errors: ValidationError[]): void {
    const parts = filename.split(".");
    if (parts.length > 2) {
      // Check if second-to-last part looks like an extension
      const secondExt = "." + parts[parts.length - 2].toLowerCase();
      const lastExt = "." + parts[parts.length - 1].toLowerCase();

      if (
        EXECUTABLE_EXTENSIONS.has(lastExt) ||
        (ARCHIVE_EXTENSIONS.has(secondExt) && EXECUTABLE_EXTENSIONS.has(lastExt))
      ) {
        errors.push({
          field: "filename",
          code: "DOUBLE_EXTENSION",
          message: `Double extension detected: ${filename}`,
          severity: "error",
        });
      }
    }
  }

  /**
   * Validates MIME type consistency with file extension
   */
  private static validateMimeType(
    filename: string,
    mimeType: string,
    errors: ValidationError[],
  ): void {
    const ext = this.getFileExtension(filename);

    // Check application/octet-stream
    if (mimeType === "application/octet-stream" && !ALLOWLISTED_OCTETS.has(filename)) {
      errors.push({
        field: "mimeType",
        code: "OCTET_STREAM_NOT_ALLOWED",
        message: "application/octet-stream MIME type is not allowed unless explicitly allowlisted",
        severity: "error",
      });
    }

    // Check MIME type consistency
    const expectedExts = MIME_TO_EXT[mimeType];
    if (expectedExts && !expectedExts.includes(ext)) {
      errors.push({
        field: "mimeType",
        code: "MIME_EXTENSION_MISMATCH",
        message: `MIME type '${mimeType}' does not match file extension '${ext}'`,
        severity: "warning",
      });
    }
  }

  /**
   * Validates archive file (for zip bomb detection)
   */
  static validateArchive(
    filename: string,
    size: number,
    fileCount: number,
    uncompressedSize: number,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const ext = this.getFileExtension(filename);

    if (!ARCHIVE_EXTENSIONS.has(ext)) {
      return { isValid: true, errors: [] };
    }

    // Check file count
    if (fileCount > LIMITS.MAX_ARCHIVE_FILES) {
      errors.push({
        field: "archive",
        code: "TOO_MANY_FILES",
        message: `Archive contains ${fileCount} files, exceeding limit of ${LIMITS.MAX_ARCHIVE_FILES}`,
        severity: "error",
      });
    }

    // Check compression ratio (zip bomb detection)
    const compressionRatio = uncompressedSize / size;
    if (compressionRatio > LIMITS.MAX_COMPRESSION_RATIO) {
      errors.push({
        field: "archive",
        code: "COMPRESSION_RATIO_EXCEEDED",
        message: `Archive compression ratio (${compressionRatio.toFixed(1)}:1) exceeds limit (${LIMITS.MAX_COMPRESSION_RATIO}:1) - possible zip bomb`,
        severity: "error",
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets file extension (lowercase, with dot)
   */
  private static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1 || lastDot === filename.length - 1) {
      return "";
    }
    return filename.substring(lastDot).toLowerCase();
  }

  /**
   * Formats byte size for display
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
}
