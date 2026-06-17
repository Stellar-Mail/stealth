import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AmbientBackground } from "@/components/mail/AmbientBackground";
import { Sidebar } from "@/components/mail/Sidebar";
import { Topbar } from "@/components/mail/Topbar";
import { EmailList } from "@/components/mail/EmailList";
import { EmailView } from "@/components/mail/EmailView";
import { Compose, type ComposeSubmission } from "@/components/mail/Compose";
import { RightPanel, type ContextAction } from "@/components/mail/RightPanel";
import { CommandPalette } from "@/components/mail/CommandPalette";
import { SettingsModal } from "@/components/mail/SettingsModal";
import {
  defaultMailFilters,
  emails as initialEmails,
  getEmailsForFolder,
  mailFolders,
  type Email,
  type MailFilters,
  type MailFolder,
} from "@/components/mail/data";
import { usePreferences } from "@/features/preferences";
import { CalendarWorkspace, useCalendar } from "@/features/calendar";
import { FeedbackViewport } from "@/features/design-system/feedback/feedback-viewport";
import { useFeedback } from "@/features/design-system/feedback/use-feedback";
import { OnboardingModal, draftToMailboxPolicy, type OnboardingDraft } from "@/features/onboarding";
import {
  SenderConversionDialog,
  resolveSenderConversion,
  useSenderConversion,
  type SenderConversionTarget,
  type SenderPolicyChoice,
} from "@/features/sender-conversion";
import { useWallet } from "@/features/wallet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stealth" },
      { name: "description", content: "Stealth is a cryptographic mail client built on Stellar." },
      { property: "og:title", content: "Stealth" },
      {
        property: "og:description",
        content: "Cryptographic mail identities, postage, and delivery proofs on Stellar.",
      },
    ],
  }),
  component: MailApp,
});

function MailApp() {
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [selectedId, setSelectedId] = useState<string | null>(initialEmails[0].id);
  const [collapsed, setCollapsed] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<{
    to?: string;
    subject?: string;
    body?: string;
  }>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customFolder, setCustomFolder] = useState<string | null>(null);
  const [filters, setFilters] = useState<MailFilters>(defaultMailFilters);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarEventId, setCalendarEventId] = useState<string | null>(null);
  const [calendarCreateRequest, setCalendarCreateRequest] = useState(0);
  const { preferences, setPreferences, hydrated } = usePreferences();
  const senderConversion = useSenderConversion();
  const wallet = useWallet({ actorAddress: preferences.actorAddress });

  // Gate: show onboarding only after localStorage has been read (hydrated) and only
  // when it has not been completed in a previous session.
  const showOnboarding = hydrated && !preferences.onboardingCompleted;

  /**
   * Called by OnboardingModal once all 7 steps are complete.
   * 1. Submits the mailbox policy to the protocol API.
   * 2. Merges the draft into local UiPreferences so Settings reflects the same values.
   * Errors propagate back to PolicyReviewStep for inline display (no silent swallow).
   */
  const handleOnboardingComplete = useCallback(
    async (walletAddress: string, draft: OnboardingDraft) => {
      const policy = draftToMailboxPolicy(draft);

      const response = await fetch(`/api/v1/policies/${walletAddress}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-stealth-address": walletAddress,
        },
        body: JSON.stringify(policy),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          (body as { error?: { message?: string } }).error?.message ??
          `Policy submission failed (HTTP ${response.status}).`;
        throw new Error(message);
      }

      setPreferences((prev) => ({
        ...prev,
        unknownSenders: draft.unknownSenderRule,
        minimumPostage: draft.minimumPostage,
        receiptOnDelivery: draft.receiptOnDelivery,
        onboardingCompleted: true,
      }));
    },
    [setPreferences],
  );
  const calendar = useCalendar();
  const { dismiss: dismissFeedback, items: feedbackItems, notify: showToast } = useFeedback();

  const folderCounts = useMemo(
    () =>
      Object.fromEntries(
        mailFolders.map((item) => [item.key, getEmailsForFolder(emails, item.key).length]),
      ) as Record<MailFolder, number>,
    [emails],
  );
  const visibleEmails = useMemo(() => getEmailsForFolder(emails, folder), [emails, folder]);
  const selected = emails.find((e) => e.id === selectedId) ?? null;

  const updateEmail = (id: string, patch: Partial<Email>) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const openCompose = (initial: { to?: string; subject?: string; body?: string } = {}) => {
    setComposeInitial(initial);
    setComposeOpen(true);
  };

  // Opening the flow is inert — it only puts the sender in focus. No policy
  // changes until the user explicitly confirms a choice in the dialog.
  const openSenderConversion = (e: Email) =>
    senderConversion.open({
      emailId: e.id,
      sender: e.from,
      address: e.email,
      currentPolicy: e.senderPolicy,
    });

  // Single applicator: mutating the shared `emails` array re-renders every open
  // surface (list, reader, sender card, sidebar counts) from one source of truth.
  const handleConvertSender = (target: SenderConversionTarget, choice: SenderPolicyChoice) => {
    const email = emails.find((item) => item.id === target.emailId);
    if (!email) return;
    const result = resolveSenderConversion(email, choice);
    updateEmail(email.id, result.patch);
    showToast(result.toast.message, { tone: result.toast.tone });
  };

  const quoteBody = (e: Email) =>
    `\n\n---\nOn ${e.time}, ${e.from} <${e.email}> wrote:\n${e.body
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n")}`;

  const emailActions = {
    onReply: (e: Email, body?: string) => {
      if (body && body.trim()) {
        showToast(`Reply sent to ${e.from}`);
        return;
      }
      openCompose({
        to: e.email,
        subject: e.subject.startsWith("Re: ") ? e.subject : `Re: ${e.subject}`,
        body: quoteBody(e),
      });
    },
    onReplyAll: (e: Email) => {
      openCompose({
        to: e.email,
        subject: e.subject.startsWith("Re: ") ? e.subject : `Re: ${e.subject}`,
        body: quoteBody(e),
      });
    },
    onForward: (e: Email) => {
      openCompose({
        to: "",
        subject: e.subject.startsWith("Fwd: ") ? e.subject : `Fwd: ${e.subject}`,
        body: quoteBody(e),
      });
    },
    onArchive: (e: Email) => {
      updateEmail(e.id, { folder: "archive" });
      showToast(`Archived "${e.subject}"`);
    },
    onTrash: (e: Email) => {
      updateEmail(e.id, { folder: "trash" });
      showToast(`Moved "${e.subject}" to trash`);
    },
    onToggleStar: (e: Email) => {
      updateEmail(e.id, { starred: !e.starred });
      showToast(e.starred ? "Removed star" : "Starred");
    },
    onConvertSender: openSenderConversion,
    onShowToast: showToast,
    onAddEvent: (e: Email) => {
      if (!e.event) return;
      const event = calendar.addMailEvent(e.event, e.id);
      showToast(`${event.title} added to your calendar`);
      return event;
    },
    getCalendarEvent: (e: Email) =>
      calendar.events.find((event) => event.sourceEmailId === e.id) ?? null,
    onOpenCalendar: (eventId?: string) => {
      setCalendarEventId(eventId ?? null);
      setCalendarOpen(true);
    },
    onCalendarResponseChange: calendar.updateResponse,
    onCalendarReminderChange: calendar.updateReminder,
  };

  const handleContextAction = (action: ContextAction, email: Email) => {
    if (action === "snooze") {
      updateEmail(email.id, { folder: "snoozed", time: "Tomorrow" });
      showToast(`Snoozed "${email.subject}" until tomorrow`);
      return;
    }
    if (action === "schedule") {
      openCompose({
        to: email.email,
        subject: email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`,
        body: quoteBody(email),
      });
      return;
    }
    if (action === "translate") {
      updateEmail(email.id, { labels: [...(email.labels ?? []), "Translated"] });
      showToast("Translation view enabled");
      return;
    }
    showToast("Conversation summary refreshed");
  };

  const handleComposeSubmit = (submission: ComposeSubmission) => {
    const message: Email = {
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
    };
    setEmails((current) => [message, ...current]);
  };

  // Mark as read on selection
  useEffect(() => {
    if (!selectedId) return;
    const cur = emails.find((e) => e.id === selectedId);
    if (cur?.unread) updateEmail(selectedId, { unread: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openCompose();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (customFolder) return;
    if (!visibleEmails.some((email) => email.id === selectedId)) {
      setSelectedId(visibleEmails[0]?.id ?? null);
    }
  }, [customFolder, folder, selectedId, visibleEmails]);

  useEffect(() => {
    if (!customFolder) return;
    const firstMatch = emails.find((email) =>
      email.labels?.some((label) => label.toLowerCase() === customFolder.toLowerCase()),
    );
    setSelectedId(firstMatch?.id ?? null);
  }, [customFolder, emails]);

  return (
    <div className="relative min-h-screen text-foreground">
      <AmbientBackground />

      <div className="flex min-h-screen">
        <Sidebar
          active={folder}
          counts={folderCounts}
          onSelect={(f) => {
            setFolder(f);
            setCustomFolder(null);
          }}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          onCompose={() => openCompose()}
          customFolder={customFolder}
          onSelectCustomFolder={setCustomFolder}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onShowToast={showToast}
            filters={filters}
            onFiltersChange={setFilters}
            onQuickAction={(action) => {
              setCustomFolder(null);
              if (action === "proofs") setFolder("pending");
              if (action === "later") setFolder("snoozed");
              if (action === "files") {
                setFolder("all");
                setFilters({ ...defaultMailFilters, hasAttachments: true });
              }
            }}
            onViewNotifications={() => {
              setCustomFolder(null);
              setFolder("inbox");
              setFilters({ ...defaultMailFilters, unreadOnly: true });
            }}
            wallet={wallet}
          />
          <div className="flex min-w-0 flex-1">
            <EmailList
              emails={emails}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onConvertSender={openSenderConversion}
              folder={folder}
              filters={filters}
              customFolder={customFolder}
              compact={preferences.compactMode}
              showAvatars={preferences.showAvatars}
            />
            <EmailView email={selected} actions={emailActions} />
            <RightPanel
              email={selected}
              onAction={handleContextAction}
              onConvertSender={openSenderConversion}
              calendarEvents={calendar.visibleEvents}
              calendars={calendar.calendars}
              onOpenCalendar={(eventId) => {
                setCalendarEventId(eventId ?? null);
                setCalendarOpen(true);
              }}
              onCreateEvent={() => {
                setCalendarEventId(null);
                setCalendarOpen(true);
                setCalendarCreateRequest((request) => request + 1);
              }}
              onDraftReply={(email, prompt) =>
                openCompose({
                  to: email.email,
                  subject: email.subject.startsWith("Re: ")
                    ? email.subject
                    : `Re: ${email.subject}`,
                  body: `${prompt}\n\nDrafted response:\nThanks for the note. I reviewed the context and will follow up with the next step shortly.${quoteBody(email)}`,
                })
              }
            />
          </div>
        </div>
      </div>

      <Compose
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onShowToast={showToast}
        initialTo={composeInitial.to}
        initialSubject={composeInitial.subject}
        initialBody={composeInitial.body}
        initialPostage={preferences.minimumPostage}
        onSubmit={handleComposeSubmit}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={preferences}
        onChange={setPreferences}
        onSave={() => showToast("Settings saved")}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onCompose={() => openCompose()}
        onNavigate={(f) => {
          setFolder(f);
          setCustomFolder(null);
        }}
        onArchive={() => {
          if (selected) {
            emailActions.onArchive(selected);
          }
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        emails={emails}
        onSelectEmail={(email) => {
          setCustomFolder(null);
          setFilters(defaultMailFilters);
          setFolder(email.folder);
          setSelectedId(email.id);
        }}
      />
      <CalendarWorkspace
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        calendars={calendar.calendars}
        events={calendar.events}
        initialEventId={calendarEventId}
        createRequest={calendarCreateRequest}
        onSaveEvent={calendar.saveEvent}
        onDeleteEvent={calendar.deleteEvent}
        onDuplicateEvent={calendar.duplicateEvent}
        onResponseChange={calendar.updateResponse}
        onReminderChange={calendar.updateReminder}
        onToggleCalendar={calendar.toggleCalendar}
        onAddCalendar={calendar.addCalendar}
        onShowToast={showToast}
      />

      <FeedbackViewport items={feedbackItems} onDismiss={dismissFeedback} />

      <OnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />

      <SenderConversionDialog
        target={senderConversion.target}
        onConfirm={handleConvertSender}
        onClose={senderConversion.close}
      />
    </div>
  );
}
