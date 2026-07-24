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
import { resolveRecipients } from "@/features/compose/recipientResolver";
import { usePostageQuote } from "@/features/compose/usePostageQuote";
import {
  RecipientPolicyBanner,
  isPolicyBlocking,
  isTrustedSender,
  getMinimumPostage,
  xlmFromStroops,
} from "@/features/compose/RecipientPolicyBanner";

import {
  getRecipientReadiness,
  parseRecipients,
  type Attachment,
  type ComposeMode,
  type ComposeSubmission,
  type RecipientReadiness,
} from "./composeValidation";
import { DeliveryEstimator, type RelayStatus } from "./DeliveryEstimator";
import { SendPipeline, type StageState } from "@/features/compose/sendPipeline";
import { SendProgress } from "@/features/compose/SendProgress";
import { useFreighter } from "@/features/onboarding/useFreighter";
const EMPTY_BLOCKED: string[] = [];
const EMPTY_RESOLVED: RecipientReadiness[] = [];

export function Compose({
  open,
  onClose,
  onShowToast,
  initialTo = "",
  initialSubject = "",
  initialBody = "",
  initialPostage = "0.0001",
  mode = "compose",
  blockedRecipients = EMPTY_BLOCKED,
  onSubmit,
  resolutionContext,
}: Readonly<{
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
  resolutionContext?: Parameters<typeof resolveRecipients>[2];
}>) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendStages, setSendStages] = useState<StageState[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const pipelineRef = useRef<SendPipeline | null>(null);
  const [encrypted, setEncrypted] = useState(true);
  const [receipt, setReceipt] = useState(true);
  const [postage, setPostage] = useState(initialPostage);
  const [resolvedRecipients, setResolvedRecipients] = useState<RecipientReadiness[]>([]);
  const [relayStatus, setRelayStatus] = useState<RelayStatus>("unknown");
  // Track whether user has manually overridden the postage field
  const postageManuallySet = useRef(false);

  // Derive the primary recipient (first entry) for policy quote
  const primaryRecipient = parseRecipients(to)[0] ?? "";
  const freighter = useFreighter();
  const senderAddress = freighter.state.status === "connected" ? freighter.state.address : "me";
  const quoteState = usePostageQuote(primaryRecipient, senderAddress);

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
      setSendStages([]);
      setSendError(null);
      pipelineRef.current = null;
      setPostage(initialPostage);
      postageManuallySet.current = false;
    } else {
      setTo("");
      setSubject("");
      setBody("");
      setAttachments([]);
      setEmojiOpen(false);
      setEncrypted(true);
      setReceipt(true);
      setPostage(initialPostage);
      setResolvedRecipients(EMPTY_RESOLVED);
      postageManuallySet.current = false;
    }
  }, [open, initialTo, initialSubject, initialBody, initialPostage]);

  // Fetch relay status when compose opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/relays/default/diagnostics")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Relay check failed"))))
      .then((data: { status: RelayStatus }) => {
        if (!cancelled) setRelayStatus(data.status ?? "unknown");
      })
      .catch(() => {
        if (!cancelled) setRelayStatus("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Auto-suggest minimum postage from policy quote when user hasn't manually set it
  useEffect(() => {
    if (postageManuallySet.current) return;
    if (quoteState.status !== "quoted") return;
    const min = getMinimumPostage(quoteState);
    if (min === null) return;
    // Convert stroops to XLM for the postage input
    if (min === "0") {
      setPostage("0");
    } else {
      const xlm = xlmFromStroops(min);
      setPostage(xlm);
    }
  }, [quoteState]);

  // Resolve recipients when `to` field changes
  useEffect(() => {
    const addresses = parseRecipients(to);
    if (!addresses.length) {
      if (resolvedRecipients.length > 0) {
        setResolvedRecipients(EMPTY_RESOLVED);
      }
      return;
    }

    // Show initial "resolving" state immediately
    setResolvedRecipients(getRecipientReadiness(to, postage, blockedRecipients));

    // Debounce resolution to avoid excessive API calls
    const timer = setTimeout(async () => {
      const resolved = await resolveRecipients(addresses, blockedRecipients, resolutionContext);

      // Update postage state based on current postage value
      const postageReady = Number.parseFloat(postage) > 0;
      const withPostage = resolved.map((r) => ({
        ...r,
        postage: postageReady ? ("ready" as const) : ("required" as const),
      }));

      setResolvedRecipients(withPostage);
    }, 300);

    return () => clearTimeout(timer);
  }, [to, blockedRecipients, postage, resolutionContext, resolvedRecipients.length]);

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
    if (open) globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
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
    const isValid = validateSendRequest({
      resolvedRecipients,
      quoteState,
      postage,
      subject,
      body,
      onShowToast,
    });
    if (!isValid) return;

    setIsSending(true);

    // Run the staged send pipeline (immediate send only).
    setSendError(null);

    if (!scheduled) {
      const pipeline =
        pipelineRef.current ??
        new SendPipeline(
          { sender: "me", to: to.trim(), subject: subject.trim(), body },
          setSendStages,
        );
      pipelineRef.current = pipeline;
      setSendStages(pipeline.getStages());

      const outcome = await pipeline.run();

      if (!outcome.ok) {
        setIsSending(false);
        if (outcome.reason === "wallet_rejected") {
          setSendError("Signature declined — your draft is safe. Retry when ready.");
          onShowToast?.("Signature declined — draft kept");
        } else if (outcome.reason === "wallet_unavailable") {
          setSendError("No Stellar wallet detected. Unlock Freighter, then retry.");
          onShowToast?.("Wallet unavailable");
        } else {
          setSendError(outcome.message);
          onShowToast?.("Send failed — you can retry");
        }
        return;
      }

      pipelineRef.current = null;
      setSendStages([]);
    }

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
    onShowToast?.(getSuccessToastMessage(scheduled, isTrustedSender(quoteState), postage));
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
                {getHeaderTitle(mode)}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/6 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-0 px-4">
              <Field label="To" placeholder="recipients@…" value={to} onChange={setTo} />
              <RecipientReadinessChips recipients={resolvedRecipients} />
              <RecipientPolicyBanner quoteState={quoteState} className="mt-1.5" />
              <DeliveryEstimator
                recipients={resolvedRecipients}
                encrypted={encrypted}
                postage={postage}
                relayStatus={relayStatus}
                onAddPostage={() => {
                  const el = document.querySelector<HTMLInputElement>(
                    '[aria-label="Postage amount"]',
                  );
                  el?.focus();
                }}
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

              {sendStages.length > 0 && (
                <SendProgress
                  stages={sendStages}
                  error={sendError}
                  onRetry={() => void handleSend(false)}
                />
              )}

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((att, i) => (
                    <div
                      key={`${att.name}-${att.size}`}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-2 py-1.5"
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
                        className="ml-1 rounded p-0.5 text-muted-foreground transition hover:bg-white/8 hover:text-foreground"
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
                className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-[11px] text-muted-foreground"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  AI suggests: &quot;{aiSuggestion}&quot;
                </span>
                <button
                  onClick={() => insertAtCursor(aiSuggestion)}
                  className="shrink-0 rounded-md border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] text-foreground/90 transition hover:bg-white/10"
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
                        onChange={(event) => {
                          postageManuallySet.current = true;
                          setPostage(event.target.value);
                        }}
                        inputMode="decimal"
                        className="w-16 rounded-sm bg-transparent font-mono outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                        aria-label="Postage amount"
                      />
                      XLM
                      {isTrustedSender(quoteState) && (
                        <span className="ml-1 text-[9px] text-emerald-400 font-medium uppercase tracking-wide">
                          free
                        </span>
                      )}
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
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-white/6 hover:text-foreground"
              >
                <Paperclip className="h-4 w-4" />
              </motion.button>

              {/* Image button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => imageInputRef.current?.click()}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-white/6 hover:text-foreground"
              >
                <ImageIcon className="h-4 w-4" />
              </motion.button>

              {/* Emoji button */}
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setEmojiOpen(!emojiOpen)}
                  className={cn(
                    "rounded-lg p-2 text-muted-foreground transition hover:bg-white/6 hover:text-foreground",
                    emojiOpen && "bg-white/6 text-foreground",
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
                className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/6 hover:text-foreground"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Schedule
              </motion.button>
              {(() => {
                const policyBlocked = isPolicyBlocking(quoteState);
                const recipientBlocked = resolvedRecipients.some(
                  (r) => r.state === "blocked" || r.state === "invalid",
                );
                const recipientResolving = resolvedRecipients.some((r) => r.state === "resolving");
                const isBlocked = policyBlocked || recipientBlocked;
                const trusted = isTrustedSender(quoteState);

                // Determine send CTA disabled state
                const isSendDisabled = isSending || isBlocked || recipientResolving;

                // Determine button label and style
                let sendLabel: string;
                let sendButtonClass: string;
                if (isSending) {
                  sendLabel = "Sending...";
                  sendButtonClass =
                    "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-foreground opacity-50 cursor-not-allowed";
                } else if (isBlocked) {
                  sendLabel = "Blocked";
                  sendButtonClass =
                    "inline-flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/[0.08] px-3 py-1.5 text-xs font-medium text-red-200 opacity-70 cursor-not-allowed";
                } else if (trusted) {
                  sendLabel = "Send free";
                  sendButtonClass =
                    "inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/[0.14]";
                } else if (quoteState.status === "quoted" && Number(postage) > 0) {
                  sendLabel = `Send + ${postage} XLM`;
                  sendButtonClass =
                    "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/[0.14]";
                } else {
                  sendLabel = "Send";
                  sendButtonClass =
                    "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/[0.14]";
                }

                const disabledReason = getDisabledReason(isBlocked, recipientResolving);

                return (
                  <motion.button
                    whileHover={isSendDisabled ? undefined : { y: -1 }}
                    whileTap={isSendDisabled ? undefined : { scale: 0.97 }}
                    onClick={() => void handleSend(false)}
                    disabled={isSendDisabled}
                    aria-disabled={isSendDisabled}
                    aria-busy={isSending}
                    title={disabledReason}
                    aria-label={disabledReason ?? sendLabel}
                    className={sendButtonClass}
                    style={
                      isSendDisabled ? undefined : { boxShadow: "0 8px 30px -10px rgba(0,0,0,0.6)" }
                    }
                  >
                    <Send className={cn("h-3.5 w-3.5", isSending && "motion-safe:animate-pulse")} />
                    {sendLabel}
                  </motion.button>
                );
              })()}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function recipientTrustState(state: RecipientReadiness["state"]): TrustState {
  if (state === "blocked") return "blocked";
  if (state === "verified") return "verified";
  if (state === "unknown") return "unknown";
  if (state === "invalid") return "blocked"; // invalid is treated like blocked visually
  return "unknown"; // resolving
}

function getRecipientChipColor(state: RecipientReadiness["state"]) {
  switch (state) {
    case "verified":
      return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
    case "blocked":
      return "border-red-300/25 bg-red-300/10 text-red-100";
    case "invalid":
      return "border-red-300/25 bg-red-300/10 text-red-100";
    case "unknown":
      return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    case "resolving":
      return "border-blue-300/25 bg-blue-300/10 text-blue-100 motion-safe:animate-pulse";
    default:
      return "border-zinc-300/25 bg-zinc-300/10 text-zinc-100";
  }
}

function RecipientReadinessChips({ recipients }: Readonly<{ recipients: RecipientReadiness[] }>) {
  if (!recipients.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-white/5 py-2 pl-[76px]">
      {recipients.map((recipient) => (
        <div
          key={recipient.address}
          title={recipient.message}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[10px] flex items-center gap-2",
            getRecipientChipColor(recipient.state),
          )}
        >
          <TrustBadge
            state={recipientTrustState(recipient.state)}
            showLabel={false}
            size="sm"
            className="shrink-0"
          />
          <span className="truncate">{recipient.address}</span>

          {/* Show account details if resolved */}
          {recipient.resolvedAccount && (
            <span className="shrink-0 text-[9px] opacity-75">
              → {recipient.resolvedAccount.slice(0, 8)}…
            </span>
          )}

          {/* Show encryption key availability */}
          {recipient.encryptionKey && (
            <span className="shrink-0 inline-block w-2 h-2 rounded-full bg-current opacity-50" />
          )}
        </div>
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
}: Readonly<{
  active: boolean;
  icon: typeof Lock;
  label: string;
  detail: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition",
        active
          ? "border-emerald-200/20 bg-emerald-200/6"
          : "border-white/10 bg-white/2.5 opacity-60",
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
}: Readonly<{
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}>) {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 py-2">
      <span className="w-16 shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="glow-ring w-full rounded-sm bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
      />
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function validateSendRequest({
  resolvedRecipients,
  quoteState,
  postage,
  subject,
  body,
  onShowToast,
}: {
  resolvedRecipients: RecipientReadiness[];
  quoteState: ReturnType<typeof usePostageQuote>;
  postage: string;
  subject: string;
  body: string;
  onShowToast?: (message: string) => void;
}) {
  if (resolvedRecipients.length === 0) {
    onShowToast?.("Please add at least one recipient");
    return false;
  }
  if (resolvedRecipients.some((r) => r.state === "resolving" || r.state === "invalid")) {
    onShowToast?.("All recipients must be verified before sending");
    return false;
  }
  if (resolvedRecipients.some((r) => r.state === "blocked")) {
    onShowToast?.("Remove blocked recipients before sending");
    return false;
  }
  if (isPolicyBlocking(quoteState)) {
    onShowToast?.("Recipient has blocked this sender");
    return false;
  }
  if (!isTrustedSender(quoteState)) {
    const currentQuote = quoteState.status === "quoted" ? quoteState.quote : null;
    if (currentQuote) {
      const postageStroops = BigInt(Math.round(Number(postage) * 10_000_000));
      const minimumStroops = BigInt(currentQuote.amount);
      if (postageStroops < minimumStroops) {
        onShowToast?.("Add postage before sending");
        return false;
      }
    } else if (resolvedRecipients.some((r) => r.postage === "required")) {
      onShowToast?.("Add postage before sending");
      return false;
    }
  }
  if (!subject.trim()) {
    onShowToast?.("Please enter a subject");
    return false;
  }
  if (!body.trim()) {
    onShowToast?.("Please enter a message");
    return false;
  }
  return true;
}

function getHeaderTitle(mode: string) {
  if (mode === "compose") return "New message";
  if (mode === "schedule") return "Schedule send";
  return mode.replace("-", " ");
}

function getDisabledReason(isBlocked: boolean, recipientResolving: boolean) {
  if (isBlocked) return "Recipient has blocked this sender";
  if (recipientResolving) return "Waiting for recipient verification";
  return undefined;
}

function getSuccessToastMessage(scheduled: boolean, trusted: boolean, postage: string) {
  if (scheduled) return "Message scheduled with postage reserved";
  if (trusted) return "Encrypted message sent (trusted — no postage required)";
  return `Encrypted message sent with ${postage} XLM postage`;
}
