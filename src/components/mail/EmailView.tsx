import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  BadgeCheck,
  CalendarClock,
  CheckCheck,
  Coins,
  Braces,
  Clock,
  File,
  FileArchive,
  FileText,
  Forward,
  Image,
  KeyRound,
  Paperclip,
  Reply,
  ReplyAll,
  Sparkles,
  Star,
  Table2,
  Send,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EventMailCard, type CalendarEvent, type CalendarResponse } from "@/features/calendar";
import { OTPCard, detectOtp } from "@/features/otp";
import { ConvertSenderButton, SenderBadge } from "@/features/sender-conversion";
import { SnoozeBanner } from "@/features/snooze";
import { ProvenancePanel } from "./ProvenancePanel";
import { EmailTrustBadges } from "./EmailTrustBadges";
import type { Email } from "./data";
import {
  getRecipientReadiness,
  validateComposeDraft,
  type Attachment,
  type ComposeMode,
  type ComposeSubmission,
} from "./composeValidation";

export type EmailViewActions = {
  onReply?: (email: Email, body?: string) => void;
  onReplyAll?: (email: Email) => void;
  onForward?: (email: Email) => void;
  onInlineSubmit?: (email: Email, submission: ComposeSubmission) => void;
  minimumPostage?: string;
  onArchive?: (email: Email) => void;
  onTrash?: (email: Email) => void;
  onToggleStar?: (email: Email) => void;
  onConvertSender?: (email: Email) => void;
  onSnooze?: (email: Email) => void;
  onUnsnooze?: (email: Email) => void;
  onSendReadReceipt?: (email: Email) => void;
  onShowToast?: (message: string) => void;
  onAddEvent?: (email: Email) => CalendarEvent | void;
  getCalendarEvent?: (email: Email) => CalendarEvent | null;
  onOpenCalendar?: (eventId?: string) => void;
  onCalendarResponseChange?: (eventId: string, response: CalendarResponse) => void;
  onCalendarReminderChange?: (eventId: string, reminder: string) => void;
  onPreviewAttachment?: (attachment: { name: string; size: string; type: string }) => void;
};

export function EmailView({
  email,
  actions = {},
}: {
  email: Email | null;
  actions?: EmailViewActions;
}) {
  const [replyMenuOpen, setReplyMenuOpen] = useState(false);
  const [inlineMode, setInlineMode] = useState<ComposeMode | null>(null);

  useEffect(() => {
    setReplyMenuOpen(false);
    setInlineMode(null);
  }, [email?.id]);

  return (
    <section className="mail-reader-atmosphere relative m-3 ml-0 flex h-[calc(100vh-3.5rem-1.5rem)] flex-1 flex-col overflow-hidden rounded-[8px]">
      <AnimatePresence mode="wait">
        {!email ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 items-center justify-center p-10 text-center"
          >
            <div>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground">No conversation selected</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a thread from the list to read it here.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={email.id}
            initial={false}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex h-full flex-col"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-2.5">
              <div className="min-w-[220px] flex-1">
                <SenderIdentity email={email} compact />
              </div>

              <div className="order-3 flex w-full min-w-0 items-center justify-center gap-1 md:order-none md:w-auto md:flex-none">
                <div className="relative">
                  <motion.button
                    key="reply"
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ y: -1 }}
                    onClick={() => setReplyMenuOpen((open) => !open)}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs transition",
                      replyMenuOpen
                        ? "bg-white/[0.08] text-foreground"
                        : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                    )}
                  >
                    <Reply className="h-3.5 w-3.5" />{" "}
                    <span className="hidden sm:inline">Reply</span>
                  </motion.button>
                  <AnimatePresence>
                    {replyMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="glass-modal absolute top-full z-40 mt-2 w-40 rounded-md p-1.5"
                      >
                        <motion.button
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setReplyMenuOpen(false);
                            setInlineMode("reply");
                          }}
                          className="w-full rounded-sm px-3 py-2 text-left text-xs text-foreground/90 transition hover:bg-white/[0.06]"
                        >
                          <div className="flex items-center gap-2">
                            <Reply className="h-3 w-3" />
                            <span>Quick reply</span>
                          </div>
                        </motion.button>
                        <motion.button
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setReplyMenuOpen(false);
                            actions.onReply?.(email);
                          }}
                          className="w-full rounded-sm px-3 py-2 text-left text-xs text-foreground/90 transition hover:bg-white/[0.06]"
                        >
                          <div className="flex items-center gap-2">
                            <Reply className="h-3 w-3" />
                            <span>Open in compose</span>
                          </div>
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {[
                  {
                    icon: ReplyAll,
                    label: "Reply all",
                    onClick: () => actions.onReplyAll?.(email),
                  },
                  { icon: Forward, label: "Forward", onClick: () => actions.onForward?.(email) },
                ].map(({ icon: Icon, label, onClick }) => (
                  <motion.button
                    key={label}
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ y: -1 }}
                    onClick={() => {
                      if (label === "Reply all") setInlineMode("reply-all");
                      else if (label === "Forward") setInlineMode("forward");
                      else onClick();
                    }}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5" />{" "}
                    <span className="hidden 2xl:inline">{label}</span>
                  </motion.button>
                ))}
              </div>

              <div className="ml-auto flex flex-none items-center justify-end gap-1">
                {actions.onConvertSender && (
                  <ConvertSenderButton
                    variant="ghost"
                    label={email.senderPolicy ? "Sender" : "Add sender"}
                    onClick={() => actions.onConvertSender?.(email)}
                    className="hidden whitespace-nowrap 2xl:inline-flex"
                  />
                )}
                {actions.onSnooze && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => actions.onSnooze?.(email)}
                    title="Snooze"
                    className="inline-flex items-center gap-1.5 rounded-md p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                  >
                    <Clock className="h-4 w-4" />
                    <ShortcutKey hint="Z" />
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => actions.onArchive?.(email)}
                  title="Archive"
                  className="inline-flex items-center gap-1.5 rounded-md p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                >
                  <Archive className="h-4 w-4" />
                  <ShortcutKey hint="E" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => actions.onTrash?.(email)}
                  title="Move to trash"
                  className="shrink-0 rounded-md p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => actions.onToggleStar?.(email)}
                  title={email.starred ? "Unstar" : "Star"}
                  className={cn(
                    "shrink-0 rounded-md p-2 transition hover:bg-white/[0.06]",
                    email.starred
                      ? "text-amber-300"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Star className={cn("h-4 w-4", email.starred && "fill-current")} />
                </motion.button>
              </div>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              <article className="mx-auto w-full max-w-[920px]">
                <div className="border-b border-white/[0.07] pb-5">
                  <div className="min-w-0 flex-1">
                    <p className="mail-reader-meta mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Conversation
                    </p>
                    <h1 className="mail-reader-title max-w-[720px] text-[26px] font-semibold leading-[1.12] text-foreground sm:text-[30px]">
                      {email.subject}
                    </h1>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {email.labels?.map((label) => (
                        <span
                          key={label}
                          className="mail-reader-meta rounded-md border border-white/[0.1] bg-white/[0.045] px-2 py-1 text-[10px] uppercase text-muted-foreground"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {email.event ? (
                  <EventMailCard
                    event={email.event}
                    calendarEvent={actions.getCalendarEvent?.(email)}
                    onAdd={() => actions.onAddEvent?.(email)}
                    onOpen={actions.onOpenCalendar}
                    onResponseChange={actions.onCalendarResponseChange}
                    onReminderChange={actions.onCalendarReminderChange}
                  />
                ) : null}

                <ProtocolStatus email={email} onShowToast={actions.onShowToast} />
                <ReceiptStatus email={email} onSendReadReceipt={actions.onSendReadReceipt} />

                {email.folder === "requests" ? (
                  <SenderRequest
                    sender={email.from}
                    address={email.email}
                    onManage={() => actions.onConvertSender?.(email)}
                  />
                ) : null}

                {email.folder === "snoozed" && email.snooze ? (
                  <SnoozeBanner
                    state={email.snooze}
                    onEdit={() => actions.onSnooze?.(email)}
                    onUnsnooze={() => actions.onUnsnooze?.(email)}
                  />
                ) : null}

                {(() => {
                  const otp = detectOtp(email.body);
                  return otp ? <OTPCard code={otp} /> : null;
                })()}

                <ReaderBody body={email.body} />

                {email.attachments?.length ? (
                  <div className="mt-7 max-w-[500px]">
                    <div className="mail-reader-meta mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Paperclip className="h-3 w-3" /> {email.attachments.length} attachment
                      {email.attachments.length > 1 ? "s" : ""}
                    </div>
                    <div className="grid max-w-[440px] grid-cols-1 gap-2 sm:grid-cols-2">
                      {email.attachments.map((attachment) => (
                        <motion.div
                          key={attachment.name}
                          onClick={() => actions.onPreviewAttachment?.(attachment)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            "glass-tile flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 transition-all duration-150",
                            actions.onPreviewAttachment &&
                              "cursor-pointer hover:bg-white/[0.08] hover:border-white/15",
                          )}
                        >
                          <AttachmentIcon type={attachment.type} />
                          <div className="min-w-0 flex-1">
                            <div className="mail-attachment-name truncate text-[11px] font-semibold leading-[14px] text-foreground/92">
                              {attachment.name}
                            </div>
                            <div className="text-[9.5px] leading-[12px] text-muted-foreground">
                              {attachment.size}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="h-8" />
              </article>
            </div>

            <AnimatePresence>
              {inlineMode && (
                <InlineReplyComposer
                  email={email}
                  mode={inlineMode}
                  minimumPostage={actions.minimumPostage ?? "0.0001"}
                  onCancel={() => setInlineMode(null)}
                  onSubmit={(submission) => {
                    actions.onInlineSubmit?.(email, submission);
                    setInlineMode(null);
                  }}
                  onSchedule={() => setInlineMode("schedule")}
                  onShowToast={actions.onShowToast}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function InlineReplyComposer({
  email,
  mode,
  minimumPostage,
  onCancel,
  onSubmit,
  onSchedule,
  onShowToast,
}: {
  email: Email;
  mode: ComposeMode;
  minimumPostage: string;
  onCancel: () => void;
  onSubmit: (submission: ComposeSubmission) => void;
  onSchedule: () => void;
  onShowToast?: (message: string) => void;
}) {
  const isForward = mode === "forward";
  const [to, setTo] = useState(isForward ? "" : email.email);
  const [body, setBody] = useState(buildInlineBody(email, mode));
  const [postage, setPostage] = useState(minimumPostage);
  const [attachments, setAttachments] = useState<Attachment[]>(
    isForward
      ? (email.attachments ?? []).map((attachment) => ({
          name: attachment.name,
          size: attachment.size,
          type: attachment.type === "image" ? "image" : "file",
        }))
      : [],
  );
  const subject = getInlineSubject(email.subject, mode);
  const blockedRecipients = email.senderPolicy === "block" ? [email.email] : [];
  const readiness = getRecipientReadiness(to, postage, blockedRecipients);

  const submit = (scheduled = false) => {
    const validationError = validateComposeDraft({ to, body, postage, blockedRecipients });
    if (validationError) {
      onShowToast?.(validationError);
      return;
    }

    onSubmit({
      to: to.trim(),
      subject,
      body,
      attachments,
      encrypted: true,
      receipt: true,
      postage,
      scheduled,
      mode: scheduled ? "schedule" : mode,
    });
    onShowToast?.(
      scheduled
        ? "Reply scheduled with postage reserved"
        : `${mode === "forward" ? "Forward" : "Reply"} sent with ${postage} XLM postage`,
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2 }}
      className="border-t border-white/[0.07] bg-white/[0.02] px-5 py-3 backdrop-blur-md sm:px-7"
    >
      <div className="mx-auto w-full max-w-[920px] space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 uppercase tracking-[0.16em] text-foreground/80">
            Inline {mode.replace("-", " ")}
          </span>
          <span className="truncate">Context: {email.subject}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder={isForward ? "Forward to…" : "Reply to…"}
            className="glow-ring rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-white/20 focus:outline-none"
          />
          <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-foreground">
            <Coins className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={postage}
              onChange={(event) => setPostage(event.target.value)}
              inputMode="decimal"
              aria-label="Reply postage"
              className="w-16 bg-transparent font-mono outline-none"
            />
            XLM
          </label>
        </div>
        {readiness.length ? (
          <div className="flex flex-wrap gap-1.5">
            {readiness.map((recipient) => (
              <span
                key={recipient.address}
                title={recipient.message}
                className={cn(
                  "rounded-full border px-2 py-1 text-[10px]",
                  recipient.policyType === "block"
                    ? "border-red-300/20 bg-red-300/[0.06] text-red-200"
                    : recipient.postage === "ready"
                      ? "border-emerald-200/20 bg-emerald-200/[0.06] text-emerald-100"
                      : "border-amber-200/20 bg-amber-200/[0.06] text-amber-100",
                )}
              >
                {recipient.address} · {recipient.policyType || "default"} · postage{" "}
                {recipient.postage}
              </span>
            ))}
          </div>
        ) : null}
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          className="glow-ring w-full resize-none rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-white/20 focus:outline-none"
        />
        {attachments.length ? (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((attachment) => (
              <span
                key={attachment.name}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-muted-foreground"
              >
                <Paperclip className="h-3 w-3" /> {attachment.name} · {attachment.size}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onSchedule}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
          >
            <CalendarClock className="h-3 w-3" /> Schedule mode
          </button>
          <button
            onClick={() => submit(mode === "schedule")}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.1] px-3 py-1.5 text-[11px] font-medium text-foreground transition hover:bg-white/[0.16]"
          >
            <Send className="h-3 w-3" /> {mode === "schedule" ? "Schedule" : "Send"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function buildInlineBody(email: Email, mode: ComposeMode) {
  const quoted = email.body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  const header = `On ${email.time}, ${email.from} <${email.email}> wrote:`;

  if (mode === "forward")
    return `\n\n---------- Forwarded message ----------\nFrom: ${email.from} <${email.email}>\nSubject: ${email.subject}\n\n${email.body}`;
  return `\n\n${header}\n${quoted}`;
}

function ShortcutKey({ hint }: { hint: string }) {
  return (
    <span className="hidden rounded border border-white/10 bg-black/30 px-1 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
      {hint}
    </span>
  );
}

function getInlineSubject(subject: string, mode: ComposeMode) {
  if (mode === "forward") return subject.startsWith("Fwd: ") ? subject : `Fwd: ${subject}`;
  return subject.startsWith("Re: ") ? subject : `Re: ${subject}`;
}

function ProtocolStatus({
  email,
  onShowToast,
}: {
  email: Email;
  onShowToast?: (message: string) => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const verified = ["verified", "priority", "encrypted", "receipts"].includes(email.folder);
  const proof = `${email.id.padStart(2, "0")}c7...${email.from.length.toString(16)}a9`;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2">
      <BadgeCheck className={cn("h-4 w-4", verified ? "text-emerald-300" : "text-amber-200")} />
      <span className="text-xs font-medium text-foreground">
        {verified ? "Stellar identity verified" : "Proof verification pending"}
      </span>
      <span className="font-mono text-[10px] text-muted-foreground">{proof}</span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-muted-foreground transition hover:text-foreground hover:bg-white/[0.08]"
        >
          Inspect provenance
        </button>
        <button
          onClick={async () => {
            await navigator.clipboard?.writeText(proof);
            onShowToast?.(`Proof ${proof} copied`);
          }}
          className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-muted-foreground transition hover:text-foreground hover:bg-white/[0.08]"
        >
          Copy proof
        </button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="glass-modal fixed left-1/2 top-1/2 z-[60] w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl p-5"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-emerald-300" />
                  <h3 className="text-sm font-semibold text-foreground">Message Provenance</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4">
                <ProvenancePanel email={email} onShowToast={onShowToast} />
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/[0.08] hover:border-white/20"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReceiptStatus({
  email,
  onSendReadReceipt,
}: {
  email: Email;
  onSendReadReceipt?: (email: Email) => void;
}) {
  if (!email.receiptState || email.receiptState === "none") {
    return null;
  }

  if (email.receiptState === "sent") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200/15 bg-emerald-200/[0.03] px-3 py-2">
        <CheckCheck className="h-4 w-4 text-emerald-300" />
        <span className="text-xs text-foreground">Read receipt sent</span>
      </div>
    );
  }

  if (email.receiptState === "pending") {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-200/15 bg-amber-200/[0.03] px-3 py-2">
        <CheckCheck className="h-4 w-4 text-amber-200" />
        <div className="flex-1">
          <div className="text-xs font-medium text-foreground">Read receipt pending</div>
          <div className="text-[11px] text-muted-foreground">
            Send a read receipt to let them know you've seen this
          </div>
        </div>
        {onSendReadReceipt && (
          <button
            onClick={() => onSendReadReceipt(email)}
            className="rounded-md bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background transition hover:opacity-90"
          >
            Send receipt
          </button>
        )}
      </div>
    );
  }

  return null;
}

function SenderRequest({
  sender,
  address,
  onManage,
}: {
  sender: string;
  address: string;
  onManage: () => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-amber-200/15 bg-amber-100/[0.035] p-4">
      <p className="text-sm font-semibold text-foreground">Decide who can mail you</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {sender} ({address}) paid postage, but is not in your trusted sender list. Review how to
        allow, verify, or block them before anything changes.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onManage}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background transition hover:opacity-90"
        >
          <BadgeCheck className="h-3.5 w-3.5" /> Review sender
        </button>
      </div>
    </div>
  );
}

function AttachmentIcon({ type }: { type: string }) {
  const { icon: Icon, className } = getAttachmentIcon(type);

  return (
    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/[0.1] bg-white/[0.06] shadow-[inset_0_1px_0_oklch(1_0_0/0.12)]">
      <Icon className={`h-4 w-4 ${className}`} />
    </div>
  );
}

function getAttachmentIcon(type: string): { icon: LucideIcon; className: string } {
  const normalized = type.toLowerCase();

  if (normalized === "pdf") return { icon: FileText, className: "text-red-300" };
  if (normalized === "key") return { icon: KeyRound, className: "text-sky-200" };
  if (normalized === "json") return { icon: Braces, className: "text-emerald-200" };
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(normalized))
    return { icon: Image, className: "text-violet-200" };
  if (["zip", "rar", "7z"].includes(normalized))
    return { icon: FileArchive, className: "text-amber-200" };
  if (["xls", "xlsx", "csv"].includes(normalized))
    return { icon: Table2, className: "text-green-200" };
  return { icon: File, className: "text-slate-200" };
}

function SenderIdentity({ email, compact = false }: { email: Email; compact?: boolean }) {
  return (
    <div
      className={`glass-tile flex w-full items-center gap-2.5 rounded-lg ${
        compact ? "max-w-[280px] p-1.5" : "max-w-[280px] p-2.5"
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
          compact ? "h-8 w-8" : "h-10 w-10"
        }`}
        style={{ background: `linear-gradient(135deg, ${email.avatarColor}, #1a1a1d)` }}
      >
        {email.from
          .split(" ")
          .map((name) => name[0])
          .slice(0, 2)
          .join("")}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mail-reader-meta flex items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold leading-4 text-foreground/92">
            {email.from}
          </span>
          <SenderBadge policy={email.senderPolicy} />
          <EmailTrustBadges email={email} max={3} size="sm" className="ml-1" />
        </div>
        <div className="mail-reader-meta truncate text-[9.5px] leading-3 text-muted-foreground/80">
          {email.email}
        </div>
      </div>
    </div>
  );
}

type BodyBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "fields"; fields: { label: string; value: string }[] }
  | { kind: "list"; items: string[] };

function ReaderBody({ body }: { body: string }) {
  const blocks = getBodyBlocks(body);

  return (
    <div className="mail-reader-body reader-copy mt-7 max-w-[68ch] space-y-5 text-[16px] leading-7 text-foreground/88 sm:text-[17px] sm:leading-8">
      {blocks.map((block, index) => {
        if (block.kind === "paragraph") {
          return (
            <p key={index} className="text-pretty">
              {block.text}
            </p>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={index} className="space-y-2 pl-1">
              {block.items.map((item) => (
                <li key={item} className="grid grid-cols-[16px_1fr] gap-2">
                  <span className="mt-[0.72em] h-1.5 w-1.5 rounded-full bg-foreground/60" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <dl key={index} className="glass-tile not-italic rounded-lg p-3">
            {block.fields.map((field) => (
              <div
                key={field.label}
                className="grid gap-1 border-b border-white/[0.06] py-2 last:border-0 sm:grid-cols-[132px_1fr] sm:gap-4"
              >
                <dt className="mail-reader-field text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="break-words font-mono text-[12px] leading-5 text-foreground/86">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        );
      })}
    </div>
  );
}

function getBodyBlocks(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  const lines = body.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (isBulletLine(line)) {
      const items: string[] = [];
      while (index < lines.length && isBulletLine(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^-\s+/, ""));
        index += 1;
      }
      blocks.push({ kind: "list", items });
      continue;
    }

    if (isFieldLine(line)) {
      const fields: { label: string; value: string }[] = [];
      while (index < lines.length && isFieldLine(lines[index].trim())) {
        fields.push(splitFieldLine(lines[index].trim()));
        index += 1;
      }
      blocks.push({ kind: "fields", fields });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (!current || isBulletLine(current) || isFieldLine(current)) break;
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function isBulletLine(line: string) {
  return /^-\s+/.test(line);
}

function isFieldLine(line: string) {
  return /^[A-Za-z][A-Za-z0-9 -]{1,32}:\s+\S/.test(line);
}

function splitFieldLine(line: string) {
  const [label, ...value] = line.split(":");
  return { label, value: value.join(":").trim() };
}
