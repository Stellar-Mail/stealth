/**
 * Security and Validation Helpers for Deal/Lead Mail Tracker
 * These utilities enforce constraints to prevent XSS, buffer overflows,
 * and performance bottlenecks before data is processed by the tracker logic.
 */

const MAX_EMAIL_BODY_LENGTH = 2048;
const MAX_SUBJECT_LENGTH = 255;
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_.-]+$/;

/**
 * Truncates an email body to prevent performance degradation on large datasets.
 */
export const truncateEmailBody = (body: string): string => {
  if (typeof body !== "string") return "";
  return body.length > MAX_EMAIL_BODY_LENGTH ? body.substring(0, MAX_EMAIL_BODY_LENGTH) : body;
};

/**
 * Basic sanitization to strip out potentially dangerous HTML tags.
 * Note: In a full integration, a robust parser like DOMPurify should be used.
 */
export const sanitizeHtmlText = (text: string): string => {
  if (typeof text !== "string") return "";
  // Strip out basic script/iframe tags
  return (
    text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      // Encode angled brackets
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  );
};

/**
 * Validates and sanitizes a subject line.
 */
export const sanitizeSubject = (subject: string): string => {
  if (typeof subject !== "string") return "No Subject";
  const truncated =
    subject.length > MAX_SUBJECT_LENGTH ? subject.substring(0, MAX_SUBJECT_LENGTH) : subject;
  return sanitizeHtmlText(truncated);
};

/**
 * Validates an email address format to prevent injection attacks or malformed routing.
 */
export const isValidEmailAddress = (email: string): boolean => {
  if (typeof email !== "string" || email.length > 320) return false;
  // Simple regex guard for structural validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Guards against directory traversal and executable extensions in attachment names.
 */
export const isSafeAttachmentName = (filename: string): boolean => {
  if (typeof filename !== "string" || filename.length > 255) return false;

  // Reject directory traversals
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return false;
  }

  // Reject executable or potentially dangerous extensions
  const dangerousExtensions = [".exe", ".sh", ".bat", ".cmd", ".vbs", ".js", ".msc"];
  const lowerFilename = filename.toLowerCase();
  if (dangerousExtensions.some((ext) => lowerFilename.endsWith(ext))) {
    return false;
  }

  // Enforce allowed character set
  return SAFE_FILENAME_REGEX.test(filename);
};
