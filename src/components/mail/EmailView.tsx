import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Coins,
  Braces,
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
  Table2,
  Send,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EventMailCard, type CalendarEvent, type CalendarResponse } from "@/features/calendar";
import { OTPCard, detectOtp } from "@/features/otp";
import { SnoozeBanner } from "@/features/snooze";
import { MailReaderSkeleton } from "@/features/design-system";
import { DegradedStateBanner } from "@/features/design-system/feedback/DegradedStateBanner";
import type { MailThread } from "@/features/mail/live-thread";
import { canRenderBody, isTrustedContent } from "@/features/mail/live-thread";
import type { ThreadReadView } from "@/features/mail/useThreadRead";
import type { ClassifiedMailSourceError } from "@/features/mail/source-view";
import { classifyAppFailure } from "@/lib/api";
import { parseSafeContent, type BodyBlock as SafeBodyBlock } from "@/features/mail/safe-rendering";
import { getCriticalMailWarning } from "@/features/mail/critical-warnings";
import type { CriticalAlertPreferences } from "@/features/preferences/types";
import { EmailTrustBadges } from "./EmailTrustBadges";
import { SenderAvatar } from "./SenderAvatar";
import { EncryptedPayloadBanner } from "./EncryptedPayloadBanner";
import type { Email, MailLocation } from "./data";
import { EmptyMailReader } from "@/features/mail/reader/EmptyMailReader";
import { MailReaderToolbar } from "@/features/mail/reader/MailReaderToolbar";
import "@/features/mail/reader/reader.css";
import {
  getRecipientReadiness,
  validateComposeDraft,
  type Attachment,
  type ComposeMode,
  type ComposeSubmission,
} from "./composeValidation";
import { getEntry } from "@/services/storage/outbox";
import { SendProgress } from "@/features/compose/SendProgress";

export type EmailViewActions = {
  onReply?: (email: Email, body?: string) => void;
  onReplyAll?: (email: Email) => void;
  onForward?: (email: Email) => void;
  onInlineSubmit?: (email: Email, submission: ComposeSubmission) => void;
  minimumPostage?: string;
  onArchive?: (email: Email) => void;
  onMarkUnread?: (email: Email) => void;
  onMove?: (email: Email, target: MailLocation) => void;
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
  onPreviewAttachment?: (attachment: {
    name: string;
    size: string;
    type: string;
    senderAddress?: string;
    encryptedCiphertext?: string;
    encryptedNonce?: string;
    encryptedMac?: string;
    expectedContentHash?: string;
    contentKey?: CryptoKey;
  }) => void;
  onRetrySend?: (email: Email) => void;
  onCancelSend?: (email: Email) => void;
  onBack?: () => void;
};

export function EmailView({
  email,
  actions = {},
  thread = null,
  threadView = { kind: "idle" },
  onRetryThread,
  onBack,
  criticalAlerts,
}: {
  email: Email | null;
  actions?: EmailViewActions;
  thread?: MailThread | null;
  threadView?: ThreadReadView;
  onRetryThread?: () => void;
  onBack?: () => void;
  criticalAlerts?: CriticalAlertPreferences;
}) {
  const [inlineMode, setInlineMode] = useState<ComposeMode | null>(null);

  useEffect(() => {
    setInlineMode(null);
  }, [email?.id]);

  const selectedThreadMessage =
    thread?.messages.find((message) => message.messageId === email?.id) ??
    thread?.messages[0] ??
    null;
  const showTrustedBody = selectedThreadMessage
    ? canRenderBody(selectedThreadMessage)
    : threadView.kind === "idle";

  const outboxEntry = email ? getEntry(email.id) : null;
  const criticalWarning = email
    ? getCriticalMailWarning(email, criticalAlerts, selectedThreadMessage?.authenticityWarning)
    : null;

  return (
    <section className="mail-reader-atmosphere relative mx-3 mt-2 sm:ml-0 flex h-[calc(100%_-_0.5rem)] flex-1 flex-col overflow-hidden rounded-t-[8px] rounded-b-none">
      <>
        {!email ? (
          <EmptyMailReader />
        ) : threadView.kind === "loading" ? (
          <MailReaderSkeleton key="thread-loading" className="h-full" />
        ) : outboxEntry ? (
          <div key={email.id} className="flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-surface-tint/5 px-3 py-2 sm:px-4 sm:py-2.5">
              {(actions.onBack || onBack) && (
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={actions.onBack || onBack}
                  aria-label="Back to conversations"
                  className="flex md:hidden items-center gap-1 rounded-md border border-surface-tint/10 bg-surface-tint/5 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-surface-tint/10 hover:text-foreground shrink-0 min-h-[36px]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-xs">Back</span>
                </motion.button>
              )}
              <div className="flex-1 min-w-0">
                <span className="rounded-full bg-surface-tint/5 border border-surface-tint/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                  {outboxEntry.status === "failed" ? "Failed Delivery" : "Pending Outbox"}
                </span>
              </div>

              <div className="ml-auto flex flex-none items-center justify-end gap-2">
                {!outboxEntry.isCommitted && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ y: -1 }}
                    onClick={() => actions.onCancelSend?.(email)}
                    className="flex items-center gap-1.5 rounded-md border border-surface-tint/10 bg-surface-tint/5 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-surface-tint/10 hover:text-foreground"
                  >
                    Cancel Send
                  </motion.button>
                )}
                {outboxEntry.status === "failed" && outboxEntry.canRetry !== false && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ y: -1 }}
                    onClick={() => actions.onRetrySend?.(email)}
                    className="flex items-center gap-1.5 rounded-md border border-blue-400/30 bg-blue-500/20 px-3.5 py-1.5 text-xs font-semibold text-status-info dark:text-blue-100 transition hover:bg-blue-500/30"
                  >
                    Retry Send
                  </motion.button>
                )}
              </div>
            </div>

            <div
              role="region"
              aria-label="Message content"
              tabIndex={0}
              className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-5"
            >
              <article className="mx-auto w-full max-w-[920px]">
                <div className="border-b border-surface-tint/[0.07] pb-5">
                  <p className="mail-reader-meta mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Outbound Message
                  </p>
                  <h1 className="mail-reader-title max-w-[720px] text-[22px] font-semibold leading-[1.15] text-foreground sm:text-[30px] break-words">
                    {email.subject}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="mail-reader-meta rounded-md border border-surface-tint/[0.1] bg-surface-tint/[0.045] px-2 py-1 text-[10px] uppercase text-muted-foreground">
                      Recipients: {outboxEntry.recipients.join(", ")}
                    </span>
                    {outboxEntry.postageAmount && (
                      <span className="mail-reader-meta rounded-md border border-surface-tint/[0.1] bg-surface-tint/[0.045] px-2 py-1 text-[10px] uppercase text-muted-foreground">
                        Postage: {outboxEntry.postageAmount} XLM
                      </span>
                    )}
                    <span className="mail-reader-meta rounded-md border border-surface-tint/[0.1] bg-surface-tint/[0.045] px-2 py-1 text-[10px] uppercase text-muted-foreground">
                      Started: {email.time}
                    </span>
                  </div>
                </div>

                {outboxEntry.stages && outboxEntry.stages.length > 0 && (
                  <div className="mt-6">
                    <SendProgress
                      stages={outboxEntry.stages.map((s) => ({
                        id: s.id as any,
                        label: s.label,
                        status: s.status as any,
                        detail: s.detail,
                      }))}
                      error={
                        outboxEntry.errorMessage ||
                        (outboxEntry.status === "failed" ? "Relay submission failed" : null)
                      }
                      failureDetails={{
                        stage: outboxEntry.stages.find((s) => s.status === "error")?.id,
                        code: outboxEntry.errorCode,
                        message: outboxEntry.errorMessage,
                        supportId: outboxEntry.supportId,
                        timestamp: outboxEntry.updatedAt,
                        isCommitted: outboxEntry.isCommitted,
                        canRetry: outboxEntry.canRetry,
                      }}
                      supportId={outboxEntry.supportId}
                      canRetry={outboxEntry.canRetry}
                      isCommitted={outboxEntry.isCommitted}
                      onRetry={() => actions.onRetrySend?.(email)}
                      onSaveDraft={() => {
                        actions.onShowToast?.("Draft already saved.");
                      }}
                    />
                  </div>
                )}

                <div className="mt-7 max-w-[68ch] space-y-4 text-sm text-muted-foreground">
                  <p>Plaintext body is not persisted locally for security and privacy reasons.</p>
                  {outboxEntry.status === "failed" && (
                    <p className="text-xs text-status-danger dark:text-red-300">
                      Error Details:{" "}
                      {outboxEntry.errorMessage ??
                        "No detailed error message was returned from the relay."}
                    </p>
                  )}
                </div>
              </article>
            </div>
          </div>
        ) : (
          <div key={email.id} className="flex h-full flex-col">
            <MailReaderToolbar
              email={email}
              actions={actions}
              onClose={actions.onBack || onBack}
              onRespond={(mode) => {
                if (actions.onInlineSubmit) {
                  setInlineMode(mode);
                } else if (mode === "reply") {
                  actions.onReply?.(email);
                } else if (mode === "reply-all") {
                  actions.onReplyAll?.(email);
                } else {
                  actions.onForward?.(email);
                }
              }}
            >
              <SenderIdentity email={email} compact />
            </MailReaderToolbar>
            <div
              role="region"
              aria-label="Message content"
              tabIndex={0}
              className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-7"
            >
              <article className="mx-auto w-full max-w-[920px]">
                <div className="border-b border-surface-tint/[0.07] pb-5">
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
                          className="mail-reader-meta rounded-md border border-surface-tint/[0.1] bg-surface-tint/[0.045] px-2 py-1 text-[10px] uppercase text-muted-foreground"
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

                {criticalWarning && (
                  <p
                    role="alert"
                    className="mt-5 border-l-2 border-status-warning pl-3 text-xs text-muted-foreground"
                  >
                    {criticalWarning}
                  </p>
                )}

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

                {threadView.kind === "error" ? (
                  <ThreadReadError failure={threadView.failure} onRetry={onRetryThread} />
                ) : null}

                {criticalAlerts?.enabled &&
                criticalAlerts.failedVerification &&
                thread?.mixedState ? (
                  <p
                    role="status"
                    className="mt-5 rounded-lg border border-amber-200/20 bg-amber-200/[0.04] px-3 py-2 text-xs text-status-warning dark:text-amber-100"
                  >
                    This conversation contains mixed verification states. Unverified or failed
                    messages never render as trusted content.
                  </p>
                ) : null}

                {thread && thread.messages.length > 1 ? (
                  <ol className="mt-5 space-y-3" aria-label="Conversation messages">
                    {thread.messages.map((message) => (
                      <li
                        key={message.messageId}
                        className="rounded-md border border-surface-tint/[0.08] bg-surface-recessed/10 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground/90">{message.sender}</span>
                          <time dateTime={message.timestamp}>{message.timestamp}</time>
                          {criticalAlerts?.enabled && (
                            <span className="uppercase tracking-[0.14em]">{message.trust}</span>
                          )}
                        </div>
                        {criticalAlerts?.enabled &&
                        criticalAlerts.failedVerification &&
                        message.authenticityWarning ? (
                          <p className="mt-1 text-[11px] text-status-warning dark:text-amber-100/90">
                            {message.authenticityWarning}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : null}

                {email.encryptedPayload ? (
                  <EncryptedPayloadBanner
                    payload={email.encryptedPayload}
                    actions={{ onRetry: onRetryThread }}
                  />
                ) : null}

                {criticalAlerts?.enabled &&
                criticalAlerts.failedVerification &&
                selectedThreadMessage?.authenticityWarning &&
                !criticalWarning &&
                !isTrustedContent(selectedThreadMessage) ? (
                  <p
                    role="alert"
                    className="mt-5 rounded-lg border border-amber-200/20 bg-amber-200/[0.04] px-3 py-2 text-xs text-status-warning dark:text-amber-100"
                  >
                    {selectedThreadMessage.authenticityWarning}
                  </p>
                ) : null}

                {criticalAlerts?.enabled && selectedThreadMessage?.remoteResources.blockedCount ? (
                  <p role="status" className="mt-3 text-[11px] text-muted-foreground">
                    {selectedThreadMessage.remoteResources.blockedCount} remote resource
                    {selectedThreadMessage.remoteResources.blockedCount === 1 ? "" : "s"} blocked.
                    Opening this message does not load external content.
                  </p>
                ) : null}

                {showTrustedBody
                  ? (() => {
                      const otp = detectOtp(email.body);
                      return otp ? <OTPCard code={otp} /> : null;
                    })()
                  : null}

                {showTrustedBody ? (
                  <ReaderBody
                    body={email.body}
                    blocks={selectedThreadMessage?.safeContent?.blocks}
                    trusted={selectedThreadMessage ? isTrustedContent(selectedThreadMessage) : true}
                  />
                ) : selectedThreadMessage ? (
                  <p className="mt-7 text-sm text-muted-foreground">
                    Message body is hidden until the envelope verifies and decrypts.
                  </p>
                ) : (
                  <ReaderBody body={email.body} trusted />
                )}

                {showTrustedBody && email.attachments?.length ? (
                  <div className="mt-7 max-w-[560px]">
                    <div className="mail-reader-meta mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Paperclip className="h-3 w-3" /> {email.attachments.length} attachment
                      {email.attachments.length > 1 ? "s" : ""}
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-2">
                      {email.attachments.map((attachment) => (
                        <button
                          type="button"
                          key={attachment.name}
                          disabled={!actions.onPreviewAttachment}
                          onClick={() =>
                            actions.onPreviewAttachment?.({
                              ...attachment,
                              senderAddress: email.email,
                              ...(email.attachmentCrypto?.attachments.find(
                                (a) => a.filename === attachment.name,
                              )
                                ? {
                                    encryptedCiphertext: email.attachmentCrypto!.attachments.find(
                                      (a) => a.filename === attachment.name,
                                    )!.ciphertext,
                                    encryptedNonce: email.attachmentCrypto!.attachments.find(
                                      (a) => a.filename === attachment.name,
                                    )!.nonce,
                                    encryptedMac: email.attachmentCrypto!.attachments.find(
                                      (a) => a.filename === attachment.name,
                                    )!.mac,
                                    expectedContentHash: email.attachmentCrypto!.attachments.find(
                                      (a) => a.filename === attachment.name,
                                    )!.contentHash,
                                    contentKey: email.attachmentCrypto!.contentKey,
                                  }
                                : {}),
                            })
                          }
                          className={cn(
                            "glow-ring flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-surface-tint/[0.025] px-3 py-2.5 text-left transition-colors disabled:opacity-60",
                            actions.onPreviewAttachment &&
                              "cursor-pointer hover:bg-surface-tint/[0.08] hover:border-surface-tint/15",
                          )}
                        >
                          <AttachmentIcon type={attachment.type} />
                          <div className="min-w-0 flex-1">
                            <div className="mail-attachment-name truncate text-xs font-medium leading-4 text-foreground/92">
                              {attachment.name}
                            </div>
                            <div className="mt-0.5 text-[10px] leading-3 text-muted-foreground">
                              {attachment.size}
                            </div>
                          </div>
                        </button>
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
          </div>
        )}
      </>
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
    const validationError = validateComposeDraft({
      to,
      body,
      postage,
      blockedRecipients,
    });
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
      className="border-t border-surface-tint/[0.07] bg-surface-tint/[0.02] px-5 py-3 backdrop-blur-md sm:px-7"
    >
      <div className="mx-auto w-full max-w-[920px] space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full border border-surface-tint/10 bg-surface-tint/[0.04] px-2 py-1 uppercase tracking-[0.16em] text-foreground/80">
            Inline {mode.replace("-", " ")}
          </span>
          <span className="truncate">Context: {email.subject}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder={isForward ? "Forward to…" : "Reply to…"}
            className="glow-ring rounded-md border border-surface-tint/10 bg-surface-tint/[0.04] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-surface-tint/20 focus:outline-none"
          />
          <label className="flex items-center gap-2 rounded-md border border-surface-tint/10 bg-surface-tint/[0.04] px-3 py-2 text-xs text-foreground">
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
                    ? "border-red-300/20 bg-red-300/[0.06] text-status-danger dark:text-red-200"
                    : recipient.postage === "ready"
                      ? "border-emerald-200/20 bg-emerald-200/[0.06] text-status-success dark:text-emerald-100"
                      : "border-amber-200/20 bg-amber-200/[0.06] text-status-warning dark:text-amber-100",
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
          className="glow-ring w-full resize-none rounded-md border border-surface-tint/10 bg-surface-tint/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-surface-tint/20 focus:outline-none"
        />
        {attachments.length ? (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((attachment) => (
              <span
                key={attachment.name}
                className="inline-flex items-center gap-1 rounded-md border border-surface-tint/10 bg-surface-tint/[0.04] px-2 py-1 text-[10px] text-muted-foreground"
              >
                <Paperclip className="h-3 w-3" /> {attachment.name} · {attachment.size}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-surface-tint/10 bg-surface-tint/[0.04] px-3 py-1.5 text-[11px] text-muted-foreground transition hover:bg-surface-tint/[0.08] hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onSchedule}
            className="inline-flex items-center gap-1.5 rounded-md border border-surface-tint/10 bg-surface-tint/[0.04] px-3 py-1.5 text-[11px] text-muted-foreground transition hover:bg-surface-tint/[0.08] hover:text-foreground"
          >
            <CalendarClock className="h-3 w-3" /> Schedule mode
          </button>
          <button
            onClick={() => submit(mode === "schedule")}
            className="inline-flex items-center gap-1.5 rounded-md border border-surface-tint/10 bg-surface-tint/[0.1] px-3 py-1.5 text-[11px] font-medium text-foreground transition hover:bg-surface-tint/[0.16]"
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

function getInlineSubject(subject: string, mode: ComposeMode) {
  if (mode === "forward") return subject.startsWith("Fwd: ") ? subject : `Fwd: ${subject}`;
  return subject.startsWith("Re: ") ? subject : `Re: ${subject}`;
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
    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface-tint/[0.04]">
      <Icon className={`h-[18px] w-[18px] ${className}`} />
    </div>
  );
}

function getAttachmentIcon(type: string): {
  icon: LucideIcon;
  className: string;
} {
  const normalized = type.toLowerCase();

  if (normalized === "pdf")
    return { icon: FileText, className: "text-status-danger dark:text-red-300" };
  if (normalized === "key")
    return { icon: KeyRound, className: "text-status-info dark:text-sky-200" };
  if (normalized === "json")
    return { icon: Braces, className: "text-status-success dark:text-emerald-200" };
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(normalized))
    return { icon: Image, className: "text-status-special dark:text-violet-200" };
  if (["zip", "rar", "7z"].includes(normalized))
    return { icon: FileArchive, className: "text-status-warning dark:text-amber-200" };
  if (["xls", "xlsx", "csv"].includes(normalized))
    return { icon: Table2, className: "text-status-success dark:text-green-200" };
  return { icon: File, className: "text-status-neutral dark:text-slate-200" };
}

function SenderIdentity({ email, compact = false }: { email: Email; compact?: boolean }) {
  return (
    <div
      className={`glass-tile flex w-full items-center gap-2.5 rounded-lg ${
        compact ? "max-w-[280px] p-1.5" : "max-w-[280px] p-2.5"
      }`}
    >
      <SenderAvatar email={email} size={compact ? "md" : "lg"} />
      <div className="min-w-0 flex-1">
        <div className="mail-reader-meta flex items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold leading-4 text-foreground/92">
            {email.from}
          </span>
          <EmailTrustBadges
            email={email}
            max={1}
            size="sm"
            showLabels={false}
            className="shrink-0"
          />
        </div>
        <div className="mail-reader-meta truncate text-[9.5px] leading-3 text-muted-foreground/80">
          {email.email}
        </div>
      </div>
    </div>
  );
}

function ThreadReadError({
  failure,
  onRetry,
}: {
  failure: ClassifiedMailSourceError;
  onRetry?: () => void;
}) {
  const classified = classifyAppFailure(failure.error, {
    online: failure.kind !== "offline",
  });
  return (
    <DegradedStateBanner
      failure={classified}
      compact
      className="mx-0 mb-0 mt-5"
      onRetry={onRetry}
    />
  );
}

function ReaderBody({
  body,
  blocks,
  trusted = true,
}: {
  body: string;
  blocks?: SafeBodyBlock[];
  trusted?: boolean;
}) {
  const resolved = blocks?.length ? blocks : parseSafeContent(body).blocks;

  return (
    <div
      data-trusted={trusted ? "true" : "false"}
      aria-label={trusted ? "Verified message body" : "Unverified sanitized message body"}
      className="mail-reader-body reader-copy mt-7 max-w-[68ch] space-y-5 text-[16px] leading-7 text-foreground/88 sm:text-[17px] sm:leading-8"
    >
      {resolved.map((block, index) => {
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
                className="grid gap-1 border-b border-surface-tint/[0.06] py-2 last:border-0 sm:grid-cols-[132px_1fr] sm:gap-4"
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
