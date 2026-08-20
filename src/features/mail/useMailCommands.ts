import { useCallback, useEffect } from "react";

import type { Email, MailFolder } from "@/components/mail/data";
import type { CalendarEvent } from "@/features/calendar";
import {
  getShortcutAction,
  type CommandId,
  type ShortcutActionId,
} from "@/features/command-palette";
import type { SenderPolicyChoice } from "@/features/sender-conversion";

export function useMailCommands({
  selected,
  minimumPostage,
  calendarEvents,
  openCompose,
  openCalendar,
  openSettings,
  openShortcuts,
  togglePalette,
  goFolder,
  archive,
  applySender,
  quickSnooze,
  showToast,
  updateEmail,
  openProofInspector,
}: {
  selected: Email | null;
  minimumPostage: string;
  calendarEvents: CalendarEvent[];
  openCompose: (initial?: { to?: string; subject?: string; body?: string }) => void;
  openCalendar: (eventId?: string | null) => void;
  openSettings: () => void;
  openShortcuts: () => void;
  togglePalette: () => void;
  goFolder: (folder: MailFolder) => void;
  archive: (email: Email) => void;
  applySender: (choice: SenderPolicyChoice, email: Email) => void;
  quickSnooze: (email: Email) => void;
  showToast: (message: string) => void;
  updateEmail: (id: string, patch: Partial<Email>) => void;
  openProofInspector: (query?: string) => void;
}) {
  const runCommand = useCallback(
    (id: CommandId, overrideEmail?: Email) => {
      const email = overrideEmail ?? selected;

      switch (id) {
        case "compose":
          openCompose();
          return;
        case "open-calendar":
          openCalendar(
            email?.event
              ? calendarEvents.find((item) => item.sourceEmailId === email.id)?.id
              : null,
          );
          return;
        case "open-settings":
          openSettings();
          return;
        case "open-shortcuts":
          openShortcuts();
          return;
        case "go-inbox":
          goFolder("inbox");
          return;
        case "go-starred":
          goFolder("starred");
          return;
        case "go-sent":
          goFolder("sent");
          return;
        case "archive-thread":
          if (email) archive(email);
          return;
        case "approve-sender":
          if (email) applySender("allow", email);
          return;
        case "block-sender":
          if (email) applySender("block", email);
          return;
        case "quote-postage":
          showToast(`Minimum postage for ${email?.from ?? "this sender"} is ${minimumPostage} XLM`);
          return;
        case "inspect-proof":
          if (email) {
            const messageHash = `0x${email.id.repeat(16).padEnd(64, "a")}d8c7e9`;
            try {
              navigator.clipboard.writeText(messageHash);
              showToast(`Proof ${messageHash.slice(0, 10)}... copied`);
            } catch {
              // Ignore clipboard exceptions in test/headless environments
            }
            openProofInspector(messageHash);
          }
          return;
        case "open-proof-inspector":
          openProofInspector("");
          return;
        case "settle-delivery":
          if (email) {
            updateEmail(email.id, { receiptState: "sent", folder: "receipts" });
            showToast(`Delivery settled for "${email.subject}"`);
          }
          return;
        case "refund-postage":
          if (email) {
            updateEmail(email.id, {
              folder: "spam",
              labels: [...(email.labels ?? []), "Refunded"],
            });
            showToast(`Postage refunded for "${email.subject}"`);
          }
          return;
        case "relay-diagnostics":
          goFolder("pending");
          showToast("Relay diagnostics opened from Pending Proof");
          return;
      }
    },
    [
      applySender,
      archive,
      calendarEvents,
      goFolder,
      minimumPostage,
      openCalendar,
      openCompose,
      openProofInspector,
      openSettings,
      openShortcuts,
      selected,
      showToast,
      updateEmail,
    ],
  );

  const runShortcutAction = useCallback(
    (action: ShortcutActionId) => {
      switch (action) {
        case "open-palette":
          togglePalette();
          return;
        case "open-shortcuts":
          openShortcuts();
          return;
        case "compose":
          runCommand("compose");
          return;
        case "archive-thread":
          runCommand("archive-thread");
          return;
        case "snooze-thread":
          if (selected) quickSnooze(selected);
          return;
        case "approve-sender":
          runCommand("approve-sender");
          return;
        case "block-sender":
          runCommand("block-sender");
          return;
        case "open-calendar":
          runCommand("open-calendar");
          return;
        case "open-settings":
          runCommand("open-settings");
          return;
        case "open-proof-inspector":
          runCommand("open-proof-inspector");
          return;
      }
    },
    [openShortcuts, quickSnooze, runCommand, selected, togglePalette],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = getShortcutAction(event);
      if (!action) return;
      event.preventDefault();
      runShortcutAction(action);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runShortcutAction]);

  return { runCommand, runShortcutAction };
}
