/**
 * AddThreadDialog — modal form for logging a new vendor mail thread.
 *
 * Accessible: role="dialog", aria-modal, Escape closes, fields labeled,
 * inline validation errors announced via role="alert".
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motionPresets } from "@/lib/motion-presets";
import type { ThreadDraft, ThreadPriority, ThreadStatus, Vendor } from "../types";

const inputClass =
  "glow-ring w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-white/20 aria-invalid:border-red-500/40";

const labelClass = "block text-[11px] font-medium text-muted-foreground mb-1";

const PRIORITIES: ThreadPriority[] = ["critical", "high", "medium", "low"];
const STATUSES: ThreadStatus[] = ["open", "awaiting-reply", "escalated", "flagged", "resolved"];

interface FieldError {
  vendorId?: string;
  subject?: string;
  priority?: string;
}

interface AddThreadDialogProps {
  open: boolean;
  vendors: Vendor[];
  defaultVendorId?: string;
  onClose: () => void;
  onSubmit: (draft: ThreadDraft) => void;
}

export function AddThreadDialog({
  open,
  vendors,
  defaultVendorId,
  onClose,
  onSubmit,
}: AddThreadDialogProps) {
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  const [vendorId, setVendorId] = useState(defaultVendorId ?? vendors[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<ThreadStatus>("open");
  const [priority, setPriority] = useState<ThreadPriority>("medium");
  const [followUpAt, setFollowUpAt] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [errors, setErrors] = useState<FieldError>({});

  // Focus on open / reset on close
  useEffect(() => {
    if (open) {
      setVendorId(defaultVendorId ?? vendors[0]?.id ?? "");
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    } else {
      setSubject("");
      setStatus("open");
      setPriority("medium");
      setFollowUpAt("");
      setExcerpt("");
      setTagsRaw("");
      setErrors({});
    }
  }, [open, defaultVendorId, vendors]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function validate(): boolean {
    const next: FieldError = {};
    if (!vendorId) next.vendorId = "Select a vendor.";
    if (!subject.trim()) next.subject = "Subject is required.";
    if (!priority) next.priority = "Priority is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    onSubmit({
      vendorId,
      subject: subject.trim(),
      status,
      priority,
      followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
      excerpt: excerpt.trim() || "(No excerpt provided.)",
      tags,
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            {...motionPresets.patterns.modal.backdrop}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            {...motionPresets.patterns.modal.content}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-thread-title"
            className="glass-strong fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-2rem))] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div>
                <h2
                  id="add-thread-title"
                  className="text-sm font-semibold text-foreground"
                >
                  Log Thread
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Track a new vendor mail thread.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="glow-ring rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* Form */}
            <form
              id="add-thread-form"
              onSubmit={handleSubmit}
              noValidate
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4 scrollbar-thin"
            >
              {/* Vendor */}
              <div>
                <label htmlFor="thread-vendor" className={labelClass}>
                  Vendor <span aria-hidden className="text-red-300">*</span>
                </label>
                <select
                  ref={firstFieldRef}
                  id="thread-vendor"
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  aria-required="true"
                  aria-invalid={!!errors.vendorId}
                  aria-describedby={errors.vendorId ? "thread-vendor-error" : undefined}
                  className={cn(inputClass, "cursor-pointer appearance-none")}
                >
                  <option value="">Select vendor…</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {errors.vendorId && (
                  <p id="thread-vendor-error" role="alert" className="mt-1 text-[11px] text-red-300">
                    {errors.vendorId}
                  </p>
                )}
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="thread-subject" className={labelClass}>
                  Subject <span aria-hidden className="text-red-300">*</span>
                </label>
                <input
                  id="thread-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Invoice dispute — June"
                  aria-required="true"
                  aria-invalid={!!errors.subject}
                  aria-describedby={errors.subject ? "thread-subject-error" : undefined}
                  className={inputClass}
                />
                {errors.subject && (
                  <p id="thread-subject-error" role="alert" className="mt-1 text-[11px] text-red-300">
                    {errors.subject}
                  </p>
                )}
              </div>

              {/* Status + Priority (2-col) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="thread-status" className={labelClass}>
                    Status
                  </label>
                  <select
                    id="thread-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ThreadStatus)}
                    className={cn(inputClass, "cursor-pointer appearance-none")}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="thread-priority" className={labelClass}>
                    Priority <span aria-hidden className="text-red-300">*</span>
                  </label>
                  <select
                    id="thread-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ThreadPriority)}
                    aria-required="true"
                    className={cn(inputClass, "cursor-pointer appearance-none")}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Follow-up date */}
              <div>
                <label htmlFor="thread-followup" className={labelClass}>
                  Follow-up date
                </label>
                <input
                  id="thread-followup"
                  type="datetime-local"
                  value={followUpAt}
                  onChange={(e) => setFollowUpAt(e.target.value)}
                  className={cn(inputClass, "[color-scheme:dark]")}
                />
              </div>

              {/* Excerpt */}
              <div>
                <label htmlFor="thread-excerpt" className={labelClass}>
                  Excerpt / notes
                </label>
                <textarea
                  id="thread-excerpt"
                  rows={3}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Brief context from the latest message…"
                  maxLength={140}
                  aria-describedby="thread-excerpt-hint"
                  className={cn(inputClass, "resize-none")}
                />
                <p
                  id="thread-excerpt-hint"
                  className="mt-0.5 text-[10px] text-muted-foreground text-right"
                >
                  {excerpt.length}/140
                </p>
              </div>

              {/* Tags */}
              <div>
                <label htmlFor="thread-tags" className={labelClass}>
                  Tags
                  <span className="ml-1 text-[10px] font-normal opacity-60">
                    (comma-separated)
                  </span>
                </label>
                <input
                  id="thread-tags"
                  type="text"
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="billing, escalation, legal"
                  aria-describedby="thread-tags-hint"
                  className={inputClass}
                />
                <p id="thread-tags-hint" className="sr-only">
                  Enter comma-separated tags to categorize this thread.
                </p>
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="glow-ring rounded-xl border border-white/10 px-4 py-2 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-thread-form"
                className="glow-ring rounded-xl border border-white/80 bg-white px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90"
              >
                Log Thread
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
