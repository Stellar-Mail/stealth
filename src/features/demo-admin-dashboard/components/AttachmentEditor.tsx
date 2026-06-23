import { useMemo, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AttachmentCategory,
  AttachmentDraft,
  DemoAttachmentRecord,
} from "../types/attachment";
import {
  categoryLabel,
  formatBytes,
  formatAttachmentSummary,
  inferCategory,
  isSafeSenderAddress,
  validateAttachmentDraft,
} from "../helpers/attachmentHelpers";
import { blankAttachmentDraft } from "../fixtures/attachmentFixtures";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ATTACHMENT_CATEGORIES: AttachmentCategory[] = [
  "document",
  "image",
  "data",
  "proof",
  "transaction",
  "archive",
  "other",
];

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export interface AttachmentEditorProps {
  /** Existing record to edit. When undefined the editor is in "add" mode. */
  record?: DemoAttachmentRecord;
  /** Called with the finished draft when the user saves. */
  onSave: (draft: AttachmentDraft, id: string) => void;
  /** Called when the user cancels or closes without saving. */
  onCancel?: () => void;
  /** Extra CSS class applied to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helper: derive initial draft from an existing record or blank template
// ---------------------------------------------------------------------------

function recordToDraft(record: DemoAttachmentRecord): AttachmentDraft {
  const { id: _id, ...draft } = record;
  return draft;
}

function generateId(fileName: string): string {
  // Derive a slug like "att-invoice-pdf" from the filename without extension.
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `att-${base || "new"}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttachmentEditor({ record, onSave, onCancel, className }: AttachmentEditorProps) {
  const isEditMode = record !== undefined;

  const [draft, setDraft] = useState<AttachmentDraft>(() =>
    isEditMode ? recordToDraft(record) : { ...blankAttachmentDraft },
  );

  // Validate on every render so inline errors stay live.
  const errors = useMemo(() => validateAttachmentDraft(draft), [draft]);
  const hasErrors = errors.length > 0;

  const fieldError = (field: keyof AttachmentDraft): string | undefined =>
    errors.find((e) => e.field === field)?.message;

  // ------------------------------------------------------------------
  // Field handlers
  // ------------------------------------------------------------------

  const set = <K extends keyof AttachmentDraft>(key: K, value: AttachmentDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleFileNameChange = (value: string) => {
    const newDraft: AttachmentDraft = { ...draft, fileName: value };
    // Auto-infer category from extension when the category is still the default.
    if (value.includes(".")) {
      const inferred = inferCategory(value);
      if (draft.category === "document" || draft.category === "other") {
        newDraft.category = inferred;
      }
    }
    setDraft(newDraft);
  };

  const handleFileSizeBytesChange = (raw: string) => {
    const parsed = parseInt(raw, 10);
    const bytes = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setDraft((prev) => ({
      ...prev,
      fileSizeBytes: bytes,
      // Auto-fill the display string when the field is currently empty or
      // was previously derived from a byte count.
      fileSize: bytes > 0 ? formatBytes(bytes) : prev.fileSize,
    }));
  };

  const handleSave = () => {
    if (hasErrors) return;
    const id = isEditMode ? record.id : generateId(draft.fileName);
    onSave(draft, id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !hasErrors) {
      e.preventDefault();
      handleSave();
    }
  };

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  const senderSafe = draft.sender ? isSafeSenderAddress(draft.sender) : true;
  const summary =
    !hasErrors && draft.fileName ? formatAttachmentSummary({ id: "", ...draft }) : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4",
        className,
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-foreground">
            {isEditMode ? "Edit Attachment" : "Add Attachment"}
          </h4>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel editing attachment"
            className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ---- File name ---- */}
      <Field label="File name *" error={fieldError("fileName")}>
        <input
          id="att-editor-file-name"
          type="text"
          value={draft.fileName}
          onChange={(e) => handleFileNameChange(e.target.value)}
          placeholder="e.g. invoice_1042.pdf"
          className={inputClass(!!fieldError("fileName"))}
          required
        />
      </Field>

      {/* ---- Category ---- */}
      <Field label="Category *" error={fieldError("category")}>
        <select
          id="att-editor-category"
          value={draft.category}
          onChange={(e) => set("category", e.target.value as AttachmentCategory)}
          className={inputClass(!!fieldError("category"))}
        >
          {ATTACHMENT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabel(cat)}
            </option>
          ))}
        </select>
      </Field>

      {/* ---- File type label ---- */}
      <Field label="File type label *" error={fieldError("fileType")}>
        <input
          id="att-editor-file-type"
          type="text"
          value={draft.fileType}
          onChange={(e) => set("fileType", e.target.value)}
          placeholder="e.g. PDF Document, JSON, PNG Image"
          className={inputClass(!!fieldError("fileType"))}
          required
        />
      </Field>

      {/* ---- Size row: bytes + display ---- */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Size (bytes) *" error={fieldError("fileSizeBytes")}>
          <input
            id="att-editor-file-size-bytes"
            type="number"
            min={0}
            step={1}
            value={draft.fileSizeBytes === 0 && !draft.fileName ? "" : draft.fileSizeBytes}
            onChange={(e) => handleFileSizeBytesChange(e.target.value)}
            placeholder="122880"
            className={inputClass(!!fieldError("fileSizeBytes"))}
            required
          />
        </Field>
        <Field label="Size display *" error={fieldError("fileSize")}>
          <input
            id="att-editor-file-size"
            type="text"
            value={draft.fileSize}
            onChange={(e) => set("fileSize", e.target.value)}
            placeholder="120 KB"
            className={inputClass(!!fieldError("fileSize"))}
            required
          />
        </Field>
      </div>

      {/* ---- Message subject ---- */}
      <Field label="Message subject *" error={fieldError("messageSubject")}>
        <input
          id="att-editor-message-subject"
          type="text"
          value={draft.messageSubject}
          onChange={(e) => set("messageSubject", e.target.value)}
          placeholder="e.g. Your relay verification code"
          className={inputClass(!!fieldError("messageSubject"))}
          required
        />
      </Field>

      {/* ---- Sender ---- */}
      <Field
        label="Sender *"
        error={fieldError("sender")}
        hint={senderSafe ? undefined : "Must use @example.com, @example.org, or *stealth.demo"}
      >
        <input
          id="att-editor-sender"
          type="text"
          value={draft.sender}
          onChange={(e) => set("sender", e.target.value)}
          placeholder="billing@example.com or relay07*stealth.demo"
          className={inputClass(!!fieldError("sender"))}
          required
        />
      </Field>

      {/* ---- Received at ---- */}
      <Field label="Received at *" error={fieldError("receivedAt")}>
        <input
          id="att-editor-received-at"
          type="datetime-local"
          value={draft.receivedAt}
          onChange={(e) => set("receivedAt", e.target.value)}
          className={inputClass(!!fieldError("receivedAt"))}
          required
        />
      </Field>

      {/* ---- Description (optional) ---- */}
      <Field label="Description" error={fieldError("description")}>
        <input
          id="att-editor-description"
          type="text"
          value={draft.description ?? ""}
          onChange={(e) => set("description", e.target.value || undefined)}
          placeholder="One-sentence description shown in the attachment detail panel."
          className={inputClass(false)}
          maxLength={200}
        />
      </Field>

      {/* ---- Preview URL (optional) ---- */}
      <Field
        label="Preview URL"
        error={fieldError("previewUrl")}
        hint="Relative path or # only — no live URLs."
      >
        <input
          id="att-editor-preview-url"
          type="text"
          value={draft.previewUrl ?? ""}
          onChange={(e) => set("previewUrl", e.target.value || undefined)}
          placeholder="#invoice-1042-preview"
          className={inputClass(!!fieldError("previewUrl"))}
        />
      </Field>

      {/* ---- Live summary preview ---- */}
      {summary && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Preview
          </h5>
          <p className="font-mono text-[11px] text-foreground/80 break-all">{summary}</p>
        </div>
      )}

      {/* ---- Action buttons ---- */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/[0.08] bg-white/[0.01] px-4 py-2 text-xs font-medium text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          id="att-editor-save"
          type="button"
          onClick={handleSave}
          disabled={hasErrors}
          aria-disabled={hasErrors}
          className={cn(
            "rounded-lg px-4 py-2 text-xs font-semibold transition",
            hasErrors
              ? "cursor-not-allowed bg-white/[0.04] text-muted-foreground"
              : "bg-foreground text-background hover:opacity-90",
          )}
        >
          {isEditMode ? "Save changes" : "Add attachment"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small field wrapper — keeps JSX above compact
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground/60">{hint}</p>}
      {error && <p className="text-xs font-medium text-rose-400">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return cn(
    "w-full rounded-lg border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none bg-black/40",
    hasError
      ? "border-red-500/50 focus:border-red-400"
      : "border-white/[0.08] focus:border-white/20",
  );
}
