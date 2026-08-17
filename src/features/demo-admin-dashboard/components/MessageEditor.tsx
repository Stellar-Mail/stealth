import { useMemo, useState } from "react";
import { FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Draft } from "../types/draft";
import { validateCampaignDrafts } from "../validation";
import { ValidationResultsPanel } from "../ValidationResultsPanel";
import type { ValidationIssue } from "../validation-types";

export interface MessageEditorProps {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onSave?: () => void;
  onCancel?: () => void;
  showPreview?: boolean;
  className?: string;
}

export function validateMessage(draft: Draft): ValidationIssue[] {
  return validateCampaignDrafts([draft]).map((issue) => ({
    ...issue,
    fieldPath: issue.fieldPath.replace(/^drafts\[\d+\]\./, ""),
  }));
}

export function parseRecipientsInput(input: string): string[] {
  return input
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
}

export function formatRecipientsDisplay(recipients: string[]): string {
  return recipients.join(", ");
}

export function formatMessagePreview(draft: Draft): string {
  return [
    `Subject: ${draft.subject}`,
    `To: ${draft.recipients.join(", ")}`,
    "---",
    draft.body,
  ].join("\n");
}

export function MessageEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  showPreview = true,
  className,
}: MessageEditorProps) {
  const [recipientsInput, setRecipientsInput] = useState(() =>
    formatRecipientsDisplay(draft.recipients),
  );

  const issues = useMemo(() => validateMessage(draft), [draft]);
  const hasErrors = issues.some((i) => i.severity === "error");

  const fieldIssues = (field: string): ValidationIssue[] =>
    issues.filter((i) => i.fieldPath === field || i.fieldPath.startsWith(`${field}[`));

  const subjectIssues = fieldIssues("subject");
  const bodyIssues = fieldIssues("body");
  const recipientIssues = fieldIssues("recipients");

  const handleSubjectChange = (value: string) => {
    onChange({ ...draft, subject: value });
  };

  const handleBodyChange = (value: string) => {
    onChange({ ...draft, body: value });
  };

  const handleRecipientsChange = (value: string) => {
    setRecipientsInput(value);
    onChange({ ...draft, recipients: parseRecipientsInput(value) });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSave && !hasErrors) {
      e.preventDefault();
      onSave();
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4",
        className,
      )}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-foreground">Edit Message</h4>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel editing"
            className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="editor-subject" className="text-xs font-medium text-muted-foreground">
          Subject *
        </label>
        <input
          id="editor-subject"
          type="text"
          value={draft.subject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          placeholder="Enter message subject"
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none bg-black/40",
            subjectIssues.length > 0
              ? "border-red-500/50 focus:border-red-400"
              : "border-white/[0.08] focus:border-white/20",
          )}
          required
        />
        {subjectIssues.length > 0 && (
          <p className="text-xs font-medium text-rose-400">{subjectIssues[0].message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="editor-recipients" className="text-xs font-medium text-muted-foreground">
          Recipients (comma-separated) *
        </label>
        <input
          id="editor-recipients"
          type="text"
          value={recipientsInput}
          onChange={(e) => handleRecipientsChange(e.target.value)}
          placeholder="e.g. alice@example.com, bob*stealth.demo"
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none bg-black/40",
            recipientIssues.length > 0
              ? "border-red-500/50 focus:border-red-400"
              : "border-white/[0.08] focus:border-white/20",
          )}
          required
        />
        {recipientIssues.length > 0 && (
          <p className="text-xs font-medium text-rose-400">{recipientIssues[0].message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="editor-body" className="text-xs font-medium text-muted-foreground">
          Message Body *
        </label>
        <textarea
          id="editor-body"
          value={draft.body}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder="Enter message body"
          rows={6}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none bg-black/40 resize-vertical",
            bodyIssues.length > 0
              ? "border-red-500/50 focus:border-red-400"
              : "border-white/[0.08] focus:border-white/20",
          )}
          required
        />
        {bodyIssues.length > 0 && (
          <p className="text-xs font-medium text-rose-400">{bodyIssues[0].message}</p>
        )}
      </div>

      {issues.length > 0 && <ValidationResultsPanel issues={issues} title="Message validation" />}

      {showPreview && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Preview
          </h5>
          <dl className="space-y-2 text-xs">
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <dt className="text-muted-foreground">Subject</dt>
              <dd className="text-foreground">{draft.subject || "(no subject)"}</dd>
            </div>
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <dt className="text-muted-foreground">To</dt>
              <dd className="font-mono text-[11px] text-foreground">
                {draft.recipients.length > 0 ? draft.recipients.join(", ") : "(no recipients)"}
              </dd>
            </div>
          </dl>
          <pre className="mt-3 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/30 p-3 font-sans text-xs leading-5 text-foreground/90">
            {draft.body || "(no body)"}
          </pre>
        </div>
      )}

      {(onSave || onCancel) && (
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
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={hasErrors}
              className={cn(
                "rounded-lg px-4 py-2 text-xs font-semibold transition",
                hasErrors
                  ? "cursor-not-allowed bg-white/[0.04] text-muted-foreground"
                  : "bg-foreground text-background hover:opacity-90",
              )}
            >
              Save
            </button>
          )}
        </div>
      )}
    </div>
  );
}
