import { useCallback, useMemo } from "react";

import type { ComposeSubmission } from "@/components/mail/composeValidation";
import type { Email, MailFolder, MailLocation, SnoozeState } from "@/components/mail/data";
import { getFolderLabel } from "@/components/mail/data";
import type { ContextAction } from "@/components/mail/RightPanel";
import type { CalendarEvent, CalendarResponse, MailEvent } from "@/features/calendar";
import {
  resolveSenderConversion,
  type SenderConversionTarget,
  type SenderPolicyChoice,
} from "@/features/sender-conversion";
import {
  buildSnoozeState,
  formatSnoozeSummary,
  getSnoozePreset,
  snoozePatch,
  unsnoozePatch,
  type SnoozeTarget,
} from "@/features/snooze";
import type { TrashResult } from "./useMailSource";
import type { FeedbackTone } from "@/features/design-system/feedback/use-feedback";
import type { MailboxFlagsPatch } from "@/lib/api";
import { flagsPatchFromEmail } from "./live-mailbox";

export function quoteBody(email: Email): string {
  return `\n\n---\nOn ${email.time}, ${email.from} <${email.email}> wrote:\n${email.body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")}`;
}

export function useMailActions(input: {
  emails: Email[];
  updateEmail: (id: string, patch: Partial<Email>) => void;
  insertEmail: (email: Email) => void;
  trashEmail: (email: Email) => Promise<TrashResult>;
  mutateMailbox?: (email: Email, patch: MailboxFlagsPatch) => Promise<TrashResult>;
  showToast: (message: string, options?: { tone: FeedbackTone }) => void;
  openCompose: (initial?: { to?: string; subject?: string; body?: string }) => void;
  openCalendar: (eventId?: string | null) => void;
  addMailEvent: (event: MailEvent, emailId: string) => CalendarEvent;
  calendarEvents: CalendarEvent[];
  updateCalendarResponse: (eventId: string, response: CalendarResponse) => void;
  updateCalendarReminder: (eventId: string, reminder: string) => void;
  previewAttachment: (attachment: { name: string; size: string; type: string }) => void;
  openSenderConversion: (email: Email) => void;
  openSnoozeDialog: (email: Email) => void;
  closeSnooze: () => void;
}) {
  const {
    emails,
    updateEmail,
    insertEmail,
    trashEmail,
    mutateMailbox,
    showToast,
    openCompose,
    openCalendar,
    addMailEvent,
    calendarEvents,
    previewAttachment,
    openSenderConversion,
    openSnoozeDialog,
    closeSnooze,
  } = input;

  const handleConvertSender = useCallback(
    (target: SenderConversionTarget, choice: SenderPolicyChoice) => {
      const email = emails.find((item) => item.id === target.emailId);
      if (!email) return;
      const result = resolveSenderConversion(email, choice);
      updateEmail(email.id, result.patch);
      showToast(result.toast.message, { tone: result.toast.tone });
    },
    [emails, showToast, updateEmail],
  );

  const applySenderCommand = useCallback(
    (choice: SenderPolicyChoice, email: Email) => {
      const result = resolveSenderConversion(email, choice);
      updateEmail(email.id, result.patch);
      showToast(result.toast.message, { tone: result.toast.tone });
    },
    [showToast, updateEmail],
  );

  const handleSnooze = useCallback(
    (target: SnoozeTarget, state: SnoozeState) => {
      updateEmail(target.emailId, snoozePatch(state));
      closeSnooze();
      showToast(formatSnoozeSummary(state), { tone: "success" });
    },
    [closeSnooze, showToast, updateEmail],
  );

  const handleUnsnooze = useCallback(
    (email: Email) => {
      updateEmail(email.id, unsnoozePatch());
      showToast(`"${email.subject}" returned to your inbox`);
    },
    [showToast, updateEmail],
  );

  const openQuickSnooze = useCallback(
    (email: Email) => {
      const now = new Date();
      const remindAt = getSnoozePreset("tomorrow").resolve(now);
      const state = buildSnoozeState("tomorrow", remindAt, now);
      handleSnooze({ emailId: email.id, subject: email.subject }, state);
    },
    [handleSnooze],
  );

  const commitFlags = useCallback(
    async (email: Email, patch: MailboxFlagsPatch, successMessage: string) => {
      if (!mutateMailbox) {
        updateEmail(email.id, {
          ...(patch.unread !== undefined ? { unread: patch.unread } : {}),
          ...(patch.starred !== undefined ? { starred: patch.starred } : {}),
          ...(patch.folder ? { folder: patch.folder } : {}),
        });
        showToast(successMessage);
        return;
      }
      const result = await mutateMailbox(email, patch);
      if (!result.ok) {
        showToast(result.reason, { tone: "danger" });
        return;
      }
      showToast(successMessage);
    },
    [mutateMailbox, showToast, updateEmail],
  );

  const handleArchive = useCallback(
    (email: Email) => {
      void commitFlags(email, { folder: "archive" }, `"${email.subject}" archived`);
    },
    [commitFlags],
  );

  const handleStar = useCallback(
    (email: Email) => {
      void commitFlags(
        email,
        { starred: !email.starred },
        email.starred ? `Unstarred "${email.subject}"` : `Starred "${email.subject}"`,
      );
    },
    [commitFlags],
  );

  const handleMove = useCallback(
    async (emailIds: string[], target: MailFolder) => {
      let moved = 0;
      for (const id of emailIds) {
        const email = emails.find((item) => item.id === id);
        if (!email || email.folder === (target as MailLocation)) continue;
        if (target === "trash") {
          const result = await trashEmail(email);
          if (result.ok) moved += 1;
          else showToast(result.reason, { tone: "danger" });
          continue;
        }
        const flags = flagsPatchFromEmail({ folder: target as MailLocation });
        if (flags && mutateMailbox) {
          const result = await mutateMailbox(email, flags);
          if (!result.ok) {
            showToast(result.reason, { tone: "danger" });
            continue;
          }
        } else {
          updateEmail(id, { folder: target as MailLocation });
        }
        moved += 1;
      }
      if (moved > 0) {
        showToast(
          `${moved === 1 ? "1 message" : `${moved} messages`} moved to ${getFolderLabel(target)}`,
        );
      }
    },
    [emails, mutateMailbox, showToast, trashEmail, updateEmail],
  );

  const handleTrash = useCallback(
    async (email: Email) => {
      const result = await trashEmail(email);
      if (result.ok) {
        showToast(`Moved "${email.subject}" to trash`);
        return;
      }
      showToast(result.reason, { tone: "danger" });
    },
    [showToast, trashEmail],
  );

  const handleContextAction = useCallback(
    (action: ContextAction, email: Email) => {
      if (action === "schedule") {
        openCompose({
          to: email.email,
          subject: email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`,
          body: quoteBody(email),
        });
        return;
      }
      if (action === "translate") {
        updateEmail(email.id, {
          labels: [...(email.labels ?? []), "Translated"],
        });
        showToast("Translation view enabled");
        return;
      }
      showToast("Conversation summary refreshed");
    },
    [openCompose, showToast, updateEmail],
  );

  const handleComposeSubmit = useCallback(
    (submission: ComposeSubmission) => {
      insertEmail({
        id: `local-${Date.now()}`,
        from: "Eve Navarro",
        email: "eve*stealth.xyz",
        subject: submission.subject,
        preview: submission.body.slice(0, 120) || "Message ready for delivery",
        body: submission.body,
        time: submission.scheduled ? "Tomorrow" : "Now",
        unread: false,
        starred: false,
        folder: submission.scheduled ? "scheduled" : "sent",
        labels: [
          submission.scheduled ? "Scheduled" : "Sent",
          ...(submission.encrypted ? ["Encrypted"] : []),
          ...(submission.receipt ? ["Receipt requested"] : []),
        ],
        attachments: submission.attachments.map((attachment) => ({
          name: attachment.name,
          size: attachment.size,
          type: attachment.type,
        })),
        avatarColor: "#5b6470",
      });
    },
    [insertEmail],
  );

  const emailActions = useMemo(
    () => ({
      onReply: (email: Email, body?: string) => {
        if (body && body.trim()) {
          showToast(`Reply sent to ${email.from}`);
          return;
        }
        openCompose({
          to: email.email,
          subject: email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`,
          body: quoteBody(email),
        });
      },
      onReplyAll: (email: Email) => {
        openCompose({
          to: email.email,
          subject: email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`,
          body: quoteBody(email),
        });
      },
      onForward: (email: Email) => {
        openCompose({
          to: "",
          subject: email.subject.startsWith("Fwd: ") ? email.subject : `Fwd: ${email.subject}`,
          body: quoteBody(email),
        });
      },
      onArchive: (email: Email) => {
        void handleArchive(email);
      },
      onTrash: (email: Email) => {
        void handleTrash(email);
      },
      onToggleStar: (email: Email) => {
        void handleStar(email);
      },
      onConvertSender: openSenderConversion,
      onSnooze: openSnoozeDialog,
      onUnsnooze: handleUnsnooze,
      onShowToast: showToast,
      onAddEvent: (email: Email) => {
        if (!email.event) return;
        const event = addMailEvent(email.event, email.id);
        showToast(`${event.title} added to your calendar`);
        return event;
      },
      getCalendarEvent: (email: Email) =>
        calendarEvents.find((event) => event.sourceEmailId === email.id) ?? null,
      onOpenCalendar: openCalendar,
      onCalendarResponseChange: input.updateCalendarResponse,
      onCalendarReminderChange: input.updateCalendarReminder,
      onPreviewAttachment: previewAttachment,
    }),
    [
      addMailEvent,
      calendarEvents,
      handleArchive,
      handleStar,
      handleTrash,
      handleUnsnooze,
      input.updateCalendarReminder,
      input.updateCalendarResponse,
      openCalendar,
      openCompose,
      openSenderConversion,
      openSnoozeDialog,
      previewAttachment,
      showToast,
      updateEmail,
    ],
  );

  return {
    emailActions,
    handleConvertSender,
    applySenderCommand,
    handleSnooze,
    handleUnsnooze,
    openQuickSnooze,
    handleArchive,
    handleStar,
    handleMove,
    handleTrash,
    handleContextAction,
    handleComposeSubmit,
  };
}
