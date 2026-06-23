/**
 * Pure helper functions for demo attachment editing in the admin dashboard.
 *
 * All functions are side-effect-free. No real file I/O, network calls, or
 * cryptographic operations are performed.
 */

import type {
  AttachmentCategory,
  AttachmentDraft,
  AttachmentFieldError,
  AttachmentValidationResult,
  DemoAttachmentRecord,
} from "../types/attachment";

// ---------------------------------------------------------------------------
// Safe-domain guard
// ---------------------------------------------------------------------------

const SAFE_SENDER_PATTERN =
  /(@example\.(com|org)|@([\w.-]+\.)?stealth\.demo|\*([\w.-]+\.)?stealth\.demo)$/i;

/**
 * Returns `true` when `sender` uses a demo-safe domain:
 * `@example.com`, `@example.org`, or any `*stealth.demo` federation handle.
 */
export function isSafeSenderAddress(sender: string): boolean {
  return SAFE_SENDER_PATTERN.test(sender.trim());
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ISO_LOCAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const FILE_SIZE_DISPLAY_PATTERN = /^\d+(\.\d+)?\s*(B|KB|MB|GB)$/i;
const ATTACHMENT_ID_PATTERN = /^att-[\w-]+$/;

/**
 * Validate an `AttachmentDraft` and return the list of field errors.
 * Returns an empty array when the draft is valid.
 *
 * Rules:
 * - `fileName` must be non-empty and contain an extension.
 * - `fileSize` must match a display-size pattern (e.g. "4.2 KB").
 * - `fileSizeBytes` must be a positive integer.
 * - `fileType` must be non-empty.
 * - `category` must be a recognised `AttachmentCategory`.
 * - `messageSubject` must be non-empty.
 * - `sender` must use a safe demo domain.
 * - `receivedAt` must be an ISO 8601 local timestamp string.
 * - `previewUrl`, if provided, must be a relative path or `#` (no live URLs).
 */
export function validateAttachmentDraft(draft: Partial<AttachmentDraft>): AttachmentFieldError[] {
  const errors: AttachmentFieldError[] = [];

  // fileName
  if (!draft.fileName || draft.fileName.trim().length === 0) {
    errors.push({ field: "fileName", message: "File name is required." });
  } else if (!draft.fileName.includes(".")) {
    errors.push({ field: "fileName", message: "File name must include a file extension." });
  }

  // fileSize (display string)
  if (!draft.fileSize || draft.fileSize.trim().length === 0) {
    errors.push({ field: "fileSize", message: 'File size is required (e.g. "4.2 KB").' });
  } else if (!FILE_SIZE_DISPLAY_PATTERN.test(draft.fileSize.trim())) {
    errors.push({ field: "fileSize", message: 'File size must be like "4.2 KB" or "120 MB".' });
  }

  // fileSizeBytes
  if (draft.fileSizeBytes === undefined || draft.fileSizeBytes === null) {
    errors.push({ field: "fileSizeBytes", message: "File size in bytes is required." });
  } else if (!Number.isInteger(draft.fileSizeBytes) || draft.fileSizeBytes < 0) {
    errors.push({
      field: "fileSizeBytes",
      message: "File size in bytes must be a non-negative integer.",
    });
  }

  // fileType
  if (!draft.fileType || draft.fileType.trim().length === 0) {
    errors.push({
      field: "fileType",
      message: 'File type label is required (e.g. "PDF Document").',
    });
  }

  // category
  const VALID_CATEGORIES: AttachmentCategory[] = [
    "document",
    "image",
    "data",
    "proof",
    "transaction",
    "archive",
    "other",
  ];
  if (!draft.category || !VALID_CATEGORIES.includes(draft.category)) {
    errors.push({
      field: "category",
      message:
        "Category must be one of: document, image, data, proof, transaction, archive, other.",
    });
  }

  // messageSubject
  if (!draft.messageSubject || draft.messageSubject.trim().length === 0) {
    errors.push({ field: "messageSubject", message: "Message subject is required." });
  }

  // sender
  if (!draft.sender || draft.sender.trim().length === 0) {
    errors.push({ field: "sender", message: "Sender address is required." });
  } else if (!isSafeSenderAddress(draft.sender)) {
    errors.push({
      field: "sender",
      message: "Sender must use a safe demo domain: @example.com, @example.org, or *stealth.demo.",
    });
  }

  // receivedAt
  if (!draft.receivedAt || draft.receivedAt.trim().length === 0) {
    errors.push({ field: "receivedAt", message: "Received timestamp is required." });
  } else if (!ISO_LOCAL_TIMESTAMP_PATTERN.test(draft.receivedAt.trim())) {
    errors.push({
      field: "receivedAt",
      message: "Received at must be an ISO 8601 local timestamp (yyyy-MM-ddTHH:mm).",
    });
  }

  // previewUrl — must not be an absolute live URL
  if (draft.previewUrl !== undefined && draft.previewUrl !== "") {
    if (/^https?:\/\//i.test(draft.previewUrl.trim())) {
      errors.push({
        field: "previewUrl",
        message: 'Preview URL must not be a live network address. Use a relative path or "#".',
      });
    }
  }

  return errors;
}

/**
 * Validate an `AttachmentDraft` and return a structured result object.
 */
export function validateAttachment(draft: Partial<AttachmentDraft>): AttachmentValidationResult {
  const errors = validateAttachmentDraft(draft);
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Derive the `AttachmentCategory` from a MIME-type or extension string.
 * Falls back to `"other"` when no match is found.
 *
 * @example
 * inferCategory("application/pdf") // "document"
 * inferCategory(".json")           // "data"
 */
export function inferCategory(mimeOrExt: string): AttachmentCategory {
  const s = mimeOrExt.toLowerCase().trim();
  if (/\/(pdf|msword|vnd\.openxmlformats|plain|rtf)/.test(s) || /\.(pdf|doc|docx|txt|rtf)$/.test(s))
    return "document";
  if (/^image\//.test(s) || /\.(png|jpg|jpeg|gif|svg|webp)$/.test(s)) return "image";
  if (/\/(json|csv|xml|yaml)/.test(s) || /\.(json|csv|xml|yaml|yml|tsv)$/.test(s)) return "data";
  if (/\.proof$/.test(s) || s.includes("proof") || s.includes("cryptographic")) return "proof";
  if (/\.tx$/.test(s) || s.includes("transaction") || s.includes("payload")) return "transaction";
  if (/\/(zip|gzip|tar)/.test(s) || /\.(zip|gz|tar|rar|7z)$/.test(s)) return "archive";
  return "other";
}

/**
 * Format a raw byte count into a human-readable display string consistent with
 * the existing preset fixtures (e.g. `"4.2 KB"`, `"120 KB"`).
 *
 * @example
 * formatBytes(4301) // "4.2 KB"
 * formatBytes(122880) // "120 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return kb % 1 === 0 ? `${kb} KB` : `${kb.toFixed(1)} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return mb % 1 === 0 ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

/**
 * Return a short icon label string for a given `AttachmentCategory`.
 * Suitable for `aria-label` usage or non-icon fallback rendering.
 */
export function categoryLabel(category: AttachmentCategory): string {
  const labels: Record<AttachmentCategory, string> = {
    document: "Document",
    image: "Image",
    data: "Data file",
    proof: "Cryptographic proof",
    transaction: "Transaction payload",
    archive: "Archive",
    other: "File",
  };
  return labels[category];
}

// ---------------------------------------------------------------------------
// Record helpers
// ---------------------------------------------------------------------------

/**
 * Validate that an attachment ID matches the expected `att-*` slug pattern.
 * Used when adding new records to prevent duplicate or malformed IDs.
 */
export function isValidAttachmentId(id: string): boolean {
  return ATTACHMENT_ID_PATTERN.test(id.trim());
}

/**
 * Create a new `DemoAttachmentRecord` by merging a draft with a provided `id`.
 * Does not perform validation — call `validateAttachmentDraft` first.
 */
export function applyDraftToRecord(id: string, draft: AttachmentDraft): DemoAttachmentRecord {
  return { id, ...draft };
}

/**
 * Return a one-line plain-text summary suitable for audit logs and tooltips.
 *
 * @example
 * formatAttachmentSummary(record)
 * // "invoice_1042.pdf · PDF Document · 120 KB · from billing@example.org"
 */
export function formatAttachmentSummary(record: DemoAttachmentRecord): string {
  return [record.fileName, record.fileType, record.fileSize, `from ${record.sender}`].join(" · ");
}

/**
 * Sort an array of `DemoAttachmentRecord` by `receivedAt` descending (newest first).
 * Returns a new array; the input is not mutated.
 */
export function sortAttachmentsByDate(records: DemoAttachmentRecord[]): DemoAttachmentRecord[] {
  return [...records].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

/**
 * Filter records whose `fileName`, `fileType`, or `sender` contains the query
 * (case-insensitive). Returns all records when `query` is blank.
 */
export function filterAttachments(
  records: DemoAttachmentRecord[],
  query: string,
): DemoAttachmentRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return records;
  return records.filter(
    (r) =>
      r.fileName.toLowerCase().includes(q) ||
      r.fileType.toLowerCase().includes(q) ||
      r.sender.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q),
  );
}
