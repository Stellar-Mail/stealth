import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  Coins,
  FileText,
  Image as ImageIcon,
  Lock,
  Paperclip,
  ReceiptText,
  Send,
  Smile,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmojiPicker } from "./EmojiPicker";
import { TrustBadge, type TrustState } from "@/features/design-system";
import { cn } from "@/lib/utils";

import {
  getRecipientReadiness,
  validateComposeDraft,
  type Attachment,
  type ComposeMode,
  type ComposeSubmission,
  type RecipientReadiness,
} from "./composeValidation";

export function Compose({
  open,
  onClose,
  onShowToast,
  initialTo = "",
  initialSubject = "",
  initialBody = "",
  initialPostage = "0.0001",
  mode = "compose",
  blockedRecipients = [],
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onShowToast?: (message: string) => void;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  initialPostage?: string;
  mode?: ComposeMode;
  blockedRecipients?: string[];
  onSubmit?: (submission: ComposeSubmission) => void;
}) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [encrypted, setEncrypted] = useState(true);
  const [receipt, setReceipt] = useState(true);
  const [postage, setPostage] = useState(initialPostage);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const aiSuggestion =
    "Confirming Friday's review at 10am — let me know if that still works for you.";

  const insertAtCursor = useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = body.slice(0, start) + text + body.slice(end);
      setBody(newValue);

      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      }, 0);
    },
    [body],
  );

  // Hydrate / reset form when opening or closing
  useEffect(() => {
    if (open) {
      setTo(initialTo);
      setSubject(initialSubject);
      setBody(initialBody);
      setPostage(initialPostage);
    } else {
      setTo("");
      setSubject("");
      setBody("");
      setAttachments([]);
      setEmojiOpen(false);
      setEncrypted(true);
      setReceipt(true);
      setPostage(initialPostage);
    }
  }, [open, initialTo, initialSubject, initialBody, initialPostage]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (emojiOpen) {
          setEmojiOpen(false);
        } else {
          onClose();
        }
      }
      // Tab to insert AI suggestion
      if (e.key === "Tab" && open && document.activeElement === textareaRef.current) {
        e.preventDefault();
        insertAtCursor(aiSuggestion);
      }
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, emojiOpen, insertAtCursor]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "file" | "image") => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      name: file.name,
      size: formatFileSize(file.size),
      type,
    }));

    setAttachments([...attachments, ...newAttachments]);
    e.target.value = ""; // Reset input
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSend = async (scheduled = false) => {
    const validationError = validateComposeDraft({ to, body, postage, blockedRecipients });
    if (validationError) {
      onShowToast?.(validationError);
      return;
    }
    if (!subject.trim()) {
      onShowToast?.("Please enter a subject");
      return;
    }

    setIsSending(true);

    // Simulate sending
    await new Promise((resolve) => setTimeout(resolve, 800));

    onSubmit?.({
      to: to.trim(),
      subject: subject.trim(),
      body,
      attachments,
      encrypted,
      receipt,
      postage,
      scheduled,
      mode: scheduled ? "schedule" : mode,
    });
    setIsSending(false);
    onClose();
    onShowToast?.(
      scheduled
        ? "Message scheduled with postage reserved"
        : `Encrypted message sent with ${postage} XLM postage`,
    );
  };

  const handleEmojiSelect = (emoji: string) => {
    insertAtCursor(emoji);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 24, scale: 0.97, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="glass-strong fixed bottom-6 right-6 z-50 w-[min(640px,calc(100vw-2rem))] overflow-hidden rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {mode === "compose"
                  ? "New message"
                  : mode === "schedule"
                    ? "Schedule send"
                    : mode.replace("-", " ")}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-0 px-4">
              <Field label="To" placeholder="recipients@…" value={to} onChange={setTo} />
              <RecipientReadinessChips
                recipients={getRecipientReadiness(to, postage, blockedRecipients)}
              />
              <Field label="Subject" placeholder="Subject" value={subject} onChange={setSubject} />
            </div>
            <div className="px-4 pb-2">
              <textarea
                ref={textareaRef}
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message…"
                className="glow-ring w-full resize-none rounded-lg border border-transparent bg-transparent px-1 py-2 text-sm placeholder:text-muted-foreground focus:border-white/10"
              />

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((att, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5"
                    >
                      {att.type === "image" ? (
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-xs text-foreground">{att.name}</span>
                      <span className="text-[10px] text-muted-foreground">{att.size}</span>
                      <button
                        onClick={() => removeAttachment(i)}
                        className="ml-1 rounded p-0.5 text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Suggestion */}
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-muted-foreground"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  AI suggests: &quot;{aiSuggestion}&quot;
                </span>
                <button
                  onClick={() => insertAtCursor(aiSuggestion)}
                  className="shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-foreground/90 transition hover:bg-white/[0.1]"
                >
                  Tab to insert
                </button>
              </motion.div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <ProtocolToggle
                  active={encrypted}
                  icon={Lock}
                  label="Encrypt"
                  detail="End-to-end"
                  onClick={() => setEncrypted((value) => !value)}
                />
                <ProtocolToggle
                  active={receipt}
                  icon={ReceiptText}
                  label="Read receipt"
                  detail="On-chain proof"
                  onClick={() => setReceipt((value) => !value)}
                />
                <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                      Postage
                    </span>
                    <span className="flex items-center gap-1 text-xs text-foreground">
                      <input
                        value={postage}
                        onChange={(event) => setPostage(event.target.value)}
                        inputMode="decimal"
                        className="w-16 bg-transparent font-mono outline-none"
                        aria-label="Postage amount"
                      />
                      XLM
                    </span>
                  </span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-1 border-t border-white/5 px-3 py-2.5">
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => handleFileSelect(e, "file")}
                className="hidden"
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFileSelect(e, "image")}
                className="hidden"
              />

              {/* Attachment button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              >
                <Paperclip className="h-4 w-4" />
              </motion.button>

              {/* Image button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => imageInputRef.current?.click()}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              >
                <ImageIcon className="h-4 w-4" />
              </motion.button>

              {/* Emoji button */}
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setEmojiOpen(!emojiOpen)}
                  className={cn(
                    "rounded-lg p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground",
                    emojiOpen && "bg-white/[0.06] text-foreground",
                  )}
                >
                  <Smile className="h-4 w-4" />
                </motion.button>
                <EmojiPicker
                  open={emojiOpen}
                  onClose={() => setEmojiOpen(false)}
                  onSelect={handleEmojiSelect}
                />
              </div>

              {/* Send button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSend(true)}
                disabled={isSending}
                className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Schedule
              </motion.button>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSend(false)}
                disabled={isSending}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/[0.14]",
                  isSending && "opacity-50 cursor-not-allowed",
                )}
                style={{ boxShadow: "0 8px 30px -10px rgba(0,0,0,0.6)" }}
              >
                <Send className={cn("h-3.5 w-3.5", isSending && "animate-pulse")} />
                {isSending ? "Sending..." : "Send"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function recipientTrustState(policy: RecipientReadiness["policy"]): TrustState {
  if (policy === "blocked") return "blocked";
  if (policy === "verify") return "verified";
  return "allowed";
}

function RecipientReadinessChips({ recipients }: { recipients: RecipientReadiness[] }) {
  if (!recipients.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-white/5 py-2 pl-[76px]">
      {recipients.map((recipient) => (
        <span
          key={recipient.address}
          title={recipient.message}
          className={cn(
            "rounded-full border px-2 py-1 text-[10px]",
            recipient.policy === "blocked"
              ? "border-red-300/20 bg-red-300/[0.06] text-red-200"
              : recipient.postage === "ready"
                ? "border-emerald-200/20 bg-emerald-200/[0.06] text-emerald-100"
                : "border-amber-200/20 bg-amber-200/[0.06] text-amber-100",
          )}
        >
          <TrustBadge
            state={recipientTrustState(recipient.policy)}
            showLabel={false}
            size="sm"
            className="mr-1 align-middle"
          />
          {recipient.address} · {recipient.policy} · postage {recipient.postage}
        </span>
      ))}
    </div>
  );
}

function ProtocolToggle({
  active,
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  active: boolean;
  icon: typeof Lock;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition",
        active
          ? "border-emerald-200/20 bg-emerald-200/[0.06]"
          : "border-white/10 bg-white/[0.025] opacity-60",
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-emerald-200" : "text-muted-foreground")} />
      <span>
        <span className="block text-xs font-medium text-foreground">{label}</span>
        <span className="block text-[10px] text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 py-2">
      <span className="w-16 shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="glow-ring w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
      />
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
