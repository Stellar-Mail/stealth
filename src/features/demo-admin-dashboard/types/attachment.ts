/**
 * Attachment types for demo admin dashboard editing.
 *
 * All data conforming to these types must remain fake, deterministic, and safe
 * for public repository review. No real file content, PII, or live network
 * references should ever appear in demo attachments.
 *
 * Sender addresses must use @example.com, @example.org, or *.stealth.demo.
 */

/** MIME-type category used to drive icon and preview behaviour in the UI. */
export type AttachmentCategory =
  | "document"
  | "image"
  | "data"
  | "proof"
  | "transaction"
  | "archive"
  | "other";

/**
 * A single demo attachment that can be added to or edited within a demo
 * message scenario. Extends the slim `PresetAttachment` shape with richer
 * metadata fields needed by the admin editor.
 */
export interface DemoAttachmentRecord {
  /** Stable unique identifier (e.g. "att-relay-spec"). */
  id: string;
  /** Human-readable file name including extension (e.g. "invoice_1042.pdf"). */
  fileName: string;
  /**
   * Display size string shown in the UI (e.g. "4.2 KB", "120 KB").
   * Not a byte count — purely cosmetic for demo rendering.
   */
  fileSize: string;
  /** Exact size in bytes used for sorting and filtering. */
  fileSizeBytes: number;
  /** Human-readable MIME category label (e.g. "PDF Document", "JSON"). */
  fileType: string;
  /** Broader category used to pick the correct file icon. */
  category: AttachmentCategory;
  /** Subject of the demo message this attachment belongs to. */
  messageSubject: string;
  /**
   * Safe sender address — must match example.com, example.org, or *.stealth.demo.
   */
  sender: string;
  /**
   * Optional short description displayed in the attachment detail panel.
   * Should be one sentence max.
   */
  description?: string;
  /**
   * Optional fake download URL for demo UI rendering only.
   * Must never point to a live network resource.
   */
  previewUrl?: string;
  /**
   * ISO 8601 local timestamp representing when the attachment was notionally
   * "received" (e.g. "2026-06-16T12:00:00").
   * Must be deterministic; do not use Date.now() or new Date().
   */
  receivedAt: string;
}

/** Fields editable in the AttachmentEditor form. `id` is immutable. */
export type AttachmentDraft = Omit<DemoAttachmentRecord, "id">;

/** A single field-level validation error from `validateAttachmentDraft`. */
export interface AttachmentFieldError {
  field: keyof AttachmentDraft;
  message: string;
}

/** Result of running `validateAttachmentDraft`. */
export interface AttachmentValidationResult {
  valid: boolean;
  errors: AttachmentFieldError[];
}
