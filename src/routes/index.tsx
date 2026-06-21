import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { AmbientBackground } from "@/components/mail/AmbientBackground";
import { cn } from "@/lib/utils";
import { BulkConfirmDialog } from "@/components/mail/BulkConfirmDialog";
import { Sidebar } from "@/components/mail/Sidebar";
import { Topbar } from "@/components/mail/Topbar";
import { BottomNavigation } from "@/components/mail/BottomNavigation";
import { EmailList } from "@/components/mail/EmailList";
import { EmailView } from "@/components/mail/EmailView";
import { Compose } from "@/components/mail/Compose";
import type { ComposeSubmission } from "@/components/mail/composeValidation";
import { RightPanel, type ContextAction } from "@/components/mail/RightPanel";
import { SettingsModal } from "@/components/mail/SettingsModal";
import { AttachmentPreviewDrawer } from "@/components/mail/AttachmentPreviewDrawer";
import {
  buildBulkActionPatch,
  getBulkActionConfirmation,
  getBulkActionProgressLabel,
  type BulkActionConfirmation,
  type BulkActionRequest,
  type BulkFailure,
  type BulkProgressState,
} from "@/components/mail/bulk-actions";
import {
  defaultMailFilters,
  deriveProof,
  emails as initialEmails,
  getEmailsForFolder,
  getFolderLabel,
  mailFolders,
  type Email,
  type MailFilters,
  type MailFolder,
  type MailLocation,
} from "@/components/mail/data";
import { usePreferences, useLayoutPreferences } from "@/features/preferences";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CalendarWorkspace, useCalendar } from "@/features/calendar";
import { FeedbackViewport } from "@/features/design-system/feedback/feedback-viewport";
import { useFeedback } from "@/features/design-system/feedback/use-feedback";
import { ContactMigrationDialog } from "@/features/contacts";
import {
  SenderConversionDialog,
  resolveSenderConversion,
  useSenderConversion,
  type SenderConversionTarget,
  type SenderPolicyChoice,
} from "@/features/sender-conversion";
import {
  CommandPalette,
  ShortcutOverlay,
  getShortcutAction,
  type CommandId,
  type ShortcutActionId,
} from "@/features/command-palette";
import {
  SnoozeDialog,
  buildSnoozeState,
  formatSnoozeSummary,
  getSnoozePreset,
  snoozePatch,
  unsnoozePatch,
  useSnooze,
  type SnoozeTarget,
} from "@/features/snooze";
import type { SnoozeState } from "@/components/mail/data";
import { useIsMobile } from "@/lib/use-media-query";
import { RequestsTriageBoard } from "@/features/requests";
import { ProofInspectorModal } from "@/features/proof-inspector";
import { SenderJourney } from "@/features/sender-journey";

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
  component: IndexPage,
});

function IndexPage() {
  return <MailApp isDemoMode />;
}

function delay(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function MailApp({ isDemoMode }: { isDemoMode?: boolean }) {
  const [showSenderJourney, setShowSenderJourney] = useState(false);
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [selectedId, setSelectedId] = useState<string | null>(initialEmails[0].id);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProgress, setBulkProgress] = useState<BulkProgressState | null>(null);
  const [bulkFailures, setBulkFailures] = useState<BulkFailure[]>([]);
  const [bulkConfirmation, setBulkConfirmation] = useState<{
    request: BulkActionRequest;
    confirmation: BulkActionConfirmation;
  } | null>(null);
  const { layout, setLayout, resetLayout, hydrated: layoutHydrated } = useLayoutPreferences();
  const { preferences, setPreferences, hydrated: prefHydrated } = usePreferences();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<{
    to?: string;
    subject?: string;
    body?: string;
  }>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [customFolder, setCustomFolder] = useState<string | null>(null);
  const [filters, setFilters] = useState<MailFilters>(defaultMailFilters);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarEventId, setCalendarEventId] = useState<string | null>(null);
  const [calendarCreateRequest, setCalendarCreateRequest] = useState(0);
  const [settingsSnapshot, setSettingsSnapshot] = useState<typeof preferences | null>(null);
  const senderConversion = useSenderConversion();
  const snooze = useSnooze();
  const isMobile = useIsMobile();
  const [previewAttachment, setPreviewAttachment] = useState<{
    name: string;
    size: string;
    type: string;
  } | null>(null);
  const [shortcutOverlayOpen, setShortcutOverlayOpen] = useState(false);
  const [proofInspectorOpen, setProofInspectorOpen] = useState(false);
  const [proofInspectorQuery, setProofInspectorQuery] = useState("");

  const handleOpenMessageFromInspector = useCallback((email: Email) => {
    setCustomFolder(null);
    setFilters(defaultMailFilters);
    setFolder(email.folder);
    setSelectedId(email.id);
    setSelectedIds([]);
  }, []);

  const calendar = useCalendar();
  const { dismiss: dismissFeedback, items: feedbackItems, notify: showToast } = useFeedback();

  const handleImportSave = useCallback(
    (result: { writes: number; rows: Array<{ name: string; address: string }> }) => {
      setImportOpen(false);
      showToast(
        `${result.writes} sender rule${result.writes !== 1 ? "s" : ""} written for ${result.rows.length} contact${result.rows.length !== 1 ? "s" : ""}`,
      );
    },
    [showToast],
  );

  const folderCounts = useMemo(
    () =>
      Object.fromEntries(
        mailFolders.map((item) => [item.key, getEmailsForFolder(emails, item.key).length]),
      ) as Record<MailFolder, number>,
    [emails],
  );
  const visibleEmails = useMemo(() => getEmailsForFolder(emails, folder), [emails, folder]);
  const selectedEmails: Email[] = useMemo(
    () => visibleEmails.filter((e) => selectedIds.includes(e.id)),
    [visibleEmails, selectedIds],
  );
  const selected: Email | null = emails.find((e) => e.id === selectedId) ?? null;
  const snoozeEmail = emails.find((email) => email.id === snooze.target?.emailId) ?? null;
  const selectedSnoozeState = snoozeEmail?.folder === "snoozed" ? snoozeEmail.snooze : undefined;

  const updateEmail = (id: string, patch: Partial<Email>) => {
    setEmails((prev) => prev.map((e: Email) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const openCompose = (initial: { to?: string; subject?: string; body?: string } = {}) => {
    setComposeInitial(initial);
    setComposeOpen(true);
  };

  const openSettings = useCallback(() => {
    setSettingsSnapshot(preferences);
    setSettingsOpen(true);
  }, [preferences]);

  const openCalendar = useCallback(
    (eventId?: string | null) => {
      setCalendarEventId(eventId ?? null);
      setCalendarOpen(true);
    },
    [setCalendarEventId, setCalendarOpen],
  );

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

  // Snooze opens the guided dialog; nothing changes until the user confirms.
  const openSnooze = (e: Email) => snooze.open({ emailId: e.id, subject: e.subject });

  const handleSnooze = (target: SnoozeTarget, state: SnoozeState) => {
    updateEmail(target.emailId, snoozePatch(state));
    snooze.close();
    showToast(formatSnoozeSummary(state), { tone: "success" });
  };

  const handleUnsnooze = (e: Email) => {
    updateEmail(e.id, unsnoozePatch());
    showToast(`"${e.subject}" returned to your inbox`);
  };

  const applySenderCommand = (choice: SenderPolicyChoice, email: Email) => {
    const result = resolveSenderConversion(email, choice);
    updateEmail(email.id, result.patch);
    showToast(result.toast.message, { tone: result.toast.tone });
  };

  const openQuickSnooze = (email: Email) => {
    const now = new Date();
    const remindAt = getSnoozePreset("tomorrow").resolve(now);
    const state = buildSnoozeState("tomorrow", remindAt, now);
    handleSnooze({ emailId: email.id, subject: email.subject }, state);
  };

  const handleArchive = (e: Email) => {
    updateEmail(e.id, { folder: "archive" });
    showToast(`"${e.subject}" archived`);
  };

  const handleStar = (e: Email) => {
    updateEmail(e.id, { starred: !e.starred });
    showToast(e.starred ? `Unstarred "${e.subject}"` : `Starred "${e.subject}"`);
  };

  const handleMove = (emailIds: string[], target: MailFolder) => {
    let moved = 0;
    for (const id of emailIds) {
      const email = emails.find((em) => em.id === id);
      if (email && email.folder !== (target as MailLocation)) {
        updateEmail(id, { folder: target as MailLocation });
        moved++;
      }
    }
    if (moved > 0) {
      showToast(
        `${moved === 1 ? "1 message" : `${moved} messages`} moved to ${getFolderLabel(target)}`,
      );
    }
  };

  const handleMobileSnooze = (e: Email) => {
    openSnooze(e);
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
    onSnooze: openSnooze,
    onUnsnooze: handleUnsnooze,
    onShowToast: showToast,
    onAddEvent: (e: Email) => {
      if (!e.event) return;
      const event = calendar.addMailEvent(e.event, e.id);
      showToast(`${event.title} added to your calendar`);
      return event;
    },
    getCalendarEvent: (e: Email) =>
      calendar.events.find((event) => event.sourceEmailId === e.id) ?? null,
    onOpenCalendar: openCalendar,
    onCalendarResponseChange: calendar.updateResponse,
    onCalendarReminderChange: calendar.updateReminder,
    onPreviewAttachment: (attachment: { name: string; size: string; type: string }) =>
      setPreviewAttachment(attachment),
  };

  const runBulkAction = async (request: BulkActionRequest) => {
    if (!selectedEmails.length) return;

    const targets = selectedEmails;
    let failures: BulkFailure[] = [];
    setBulkFailures([]);
    setBulkProgress({
      action: request.action,
      label: getBulkActionProgressLabel(request, targets.length),
      total: targets.length,
      completed: 0,
      failures: [],
    });

    for (const email of targets) {
      const result = buildBulkActionPatch(request, email);
      if (!result.ok) {
        failures = [...failures, { id: email.id, subject: email.subject, reason: result.reason }];
        setBulkProgress((current) =>
          current
            ? {
                ...current,
                completed: current.completed + 1,
                failures,
              }
            : current,
        );
        continue;
      }

      updateEmail(email.id, result.patch);
      await delay(90);
      setBulkProgress((current) =>
        current
          ? {
              ...current,
              completed: current.completed + 1,
              failures,
            }
          : current,
      );
    }

    const successCount = targets.length - failures.length;
    setBulkFailures(failures);
    setBulkProgress((current) =>
      current
        ? {
            ...current,
            completed: current.total,
            failures,
          }
        : current,
    );
    setSelectedIds([]);

    if (failures.length > 0) {
      showToast(
        `${failures.length} selected message${failures.length === 1 ? "" : "s"} could not be updated`,
        { tone: "danger" },
      );
    } else if (successCount > 0) {
      showToast(`${getBulkActionProgressLabel(request, successCount)} complete`);
    }
  };

  const handleBulkActionRequest = (request: BulkActionRequest) => {
    if (!selectedEmails.length) return;
    const confirmation = getBulkActionConfirmation(request, selectedEmails);
    if (confirmation) {
      setBulkConfirmation({ request, confirmation });
      return;
    }
    void runBulkAction(request);
  };

  const handleContextAction = (action: ContextAction, email: Email) => {
    // Snooze is handled by the guided dialog via onSnooze, not here.
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
  }, [selectedId]);
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
              ? calendar.events.find((item) => item.sourceEmailId === email.id)?.id
              : null,
          );
          return;
        case "open-settings":
          openSettings();
          return;
        case "open-shortcuts":
          setShortcutOverlayOpen(true);
          return;
        case "go-inbox":
          setCustomFolder(null);
          setFolder("inbox");
          return;
        case "go-starred":
          setCustomFolder(null);
          setFolder("starred");
          return;
        case "go-sent":
          setCustomFolder(null);
          setFolder("sent");
          return;
        case "archive-thread":
          if (email) handleArchive(email);
          return;
        case "approve-sender":
          if (email) applySenderCommand("allow", email);
          return;
        case "block-sender":
          if (email) applySenderCommand("block", email);
          return;
        case "quote-postage":
          showToast(
            `Minimum postage for ${email?.from ?? "this sender"} is ${preferences.minimumPostage} XLM`,
          );
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
            setProofInspectorQuery(messageHash);
            setProofInspectorOpen(true);
          }
          return;
        case "open-proof-inspector":
          setProofInspectorQuery("");
          setProofInspectorOpen(true);
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
          setCustomFolder(null);
          setFolder("pending");
          showToast("Relay diagnostics opened from Pending Proof");
          return;
      }
    },
    [
      applySenderCommand,
      calendar.events,
      handleArchive,
      openCalendar,
      openCompose,
      openSettings,
      preferences.minimumPostage,
      selected,
      showToast,
      updateEmail,
    ],
  );

  const runShortcutAction = useCallback(
    (action: ShortcutActionId) => {
      switch (action) {
        case "open-palette":
          setPaletteOpen((open) => !open);
          return;
        case "open-shortcuts":
          setShortcutOverlayOpen(true);
          return;
        case "compose":
          runCommand("compose");
          return;
        case "archive-thread":
          runCommand("archive-thread");
          return;
        case "snooze-thread":
          if (selected) openQuickSnooze(selected);
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
    [openQuickSnooze, runCommand, selected],
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const action = getShortcutAction(e);
      if (!action) return;
      e.preventDefault();
      runShortcutAction(action);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [runShortcutAction]);

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

  const isTest = typeof window !== "undefined" && !!window.navigator.webdriver;

  if (showSenderJourney) {
    return (
      <div className="h-screen">
        <SenderJourney />
        <button
          onClick={() => setShowSenderJourney(false)}
          className="fixed top-4 left-4 rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-xs text-white/80 hover:bg-black/70 z-50"
        >
          Back to app
        </button>
      </div>
    );
  }

  return (
    <MotionConfig transition={isTest ? { duration: 0 } : undefined}>
      <div
        data-hydrated={layoutHydrated && prefHydrated}
        className="relative h-screen overflow-hidden text-foreground"
      >
        <AmbientBackground />
        {isDemoMode && (
          <div className="absolute top-0 inset-x-0 z-50 bg-primary/20 backdrop-blur-md border-b border-primary/30 py-1 text-center text-xs font-medium text-primary shadow-sm pointer-events-none">
            Demo Mode: Showing placeholder data.
          </div>
        )}

        <ResizablePanelGroup
          direction="horizontal"
          className="flex h-full w-full"
          onLayoutChanged={(sizes) => {
            if (isMobile || !sizes.length) return;
            const sidebarWidth = sizes[0];
            if (sidebarWidth > 4) {
              setLayout({ sidebarWidth });
            }
          }}
        >
          {!isMobile && (
            <>
              <ResizablePanel
                defaultSize={layout.sidebarWidth}
                minSize={4}
                maxSize={20}
                collapsible
                onCollapse={() => setLayout({ sidebarCollapsed: true })}
                onExpand={() => setLayout({ sidebarCollapsed: false })}
                className={cn(
                  layout.sidebarCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out",
                )}
              >
                <Sidebar
                  active={folder}
                  counts={folderCounts}
                  onSelect={(f) => {
                    setFolder(f);
                    setCustomFolder(null);
                  }}
                  collapsed={layout.sidebarCollapsed}
                  onToggle={() => setLayout({ sidebarCollapsed: !layout.sidebarCollapsed })}
                  onCompose={() => openCompose()}
                  customFolder={customFolder}
                  onSelectCustomFolder={setCustomFolder}
                  onOpenSenderJourney={() => setShowSenderJourney(true)}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          {isMobile && (
            <Sidebar
              active={folder}
              counts={folderCounts}
              onSelect={(f) => {
                setFolder(f);
                setCustomFolder(null);
              }}
              collapsed={layout.sidebarCollapsed}
              onToggle={() => setLayout({ sidebarCollapsed: !layout.sidebarCollapsed })}
              onCompose={() => openCompose()}
              customFolder={customFolder}
              onSelectCustomFolder={setCustomFolder}
            />
          )}

          <ResizablePanel defaultSize={isMobile ? 100 : 100 - layout.sidebarWidth}>
            <div className="flex h-full flex-col min-w-0 pb-[72px] md:pb-0">
              <Topbar
                onOpenPalette={() => setPaletteOpen(true)}
                onOpenSettings={openSettings}
                onOpenProofInspector={() => runCommand("open-proof-inspector")}
                onOpenShortcuts={() => setShortcutOverlayOpen(true)}
                onImportContacts={() => setImportOpen(true)}
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
              />
              <div className="flex min-h-0 min-w-0 flex-1">
                {folder === "requests" ? (
                  <RequestsTriageBoard
                    emails={emails}
                    onUpdateEmail={updateEmail}
                    onShowToast={showToast}
                  />
                ) : (
                  <ResizablePanelGroup
                    direction="horizontal"
                    className="h-full w-full"
                    onLayoutChanged={(sizes) => {
                      if (isMobile || sizes.length < 2) return;
                      const listWidth = sizes[0];
                      const readerWidth = sizes[1];
                      if (listWidth >= 20 && readerWidth >= 30) {
                        setLayout({
                          listWidth,
                          readerWidth,
                        });
                      }
                    }}
                  >
                    <ResizablePanel defaultSize={isMobile ? 100 : layout.listWidth} minSize={20}>
                      <EmailList
                        emails={emails}
                        selectedId={selectedId}
                        selectedIds={selectedIds}
                        onSelect={setSelectedId}
                        onSelectionChange={setSelectedIds}
                        onBulkAction={handleBulkActionRequest}
                        bulkProgress={bulkProgress}
                        bulkFailures={bulkFailures}
                        onConvertSender={openSenderConversion}
                        folder={folder}
                        filters={filters}
                        customFolder={customFolder}
                        compact={layout.compactMode || preferences.compactMode}
                        showAvatars={preferences.showAvatars}
                        useMobile={isMobile}
                        onArchive={handleArchive}
                        onStar={handleStar}
                        onSnooze={handleMobileSnooze}
                      />
                    </ResizablePanel>
                    {!isMobile && (
                      <>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={layout.readerWidth} minSize={30}>
                          <EmailView email={selected} actions={emailActions} />
                        </ResizablePanel>
                        <ResizableHandle withHandle />
                        <ResizablePanel
                          defaultSize={100 - layout.listWidth - layout.readerWidth}
                          minSize={15}
                          collapsible
                          collapsedSize={0}
                          onCollapse={() => setLayout({ rightPanelCollapsed: true })}
                          onExpand={() => setLayout({ rightPanelCollapsed: false })}
                        >
                          <RightPanel
                            email={selected}
                            onAction={handleContextAction}
                            onConvertSender={openSenderConversion}
                            onSnooze={openSnooze}
                            calendarEvents={calendar.visibleEvents}
                            calendars={calendar.calendars}
                            onShowToast={showToast}
                            onOpenCalendar={openCalendar}
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
                            onPreviewAttachment={(attachment) => setPreviewAttachment(attachment)}
                          />
                        </ResizablePanel>
                      </>
                    )}
                  </ResizablePanelGroup>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        <BulkConfirmDialog
          confirmation={bulkConfirmation?.confirmation ?? null}
          onCancel={() => setBulkConfirmation(null)}
          onConfirm={() => {
            const request = bulkConfirmation?.request;
            setBulkConfirmation(null);
            if (request) void runBulkAction(request);
          }}
        />

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
          onClose={() => {
            setSettingsOpen(false);
            setSettingsSnapshot(null);
          }}
          onCancel={() => {
            if (settingsSnapshot) setPreferences(settingsSnapshot);
            setSettingsOpen(false);
            setSettingsSnapshot(null);
            showToast("Settings changes discarded");
          }}
          preferences={preferences}
          onChange={setPreferences}
          layout={layout}
          onLayoutChange={setLayout}
          onResetLayout={resetLayout}
          onSave={() => {
            setSettingsSnapshot(null);
            showToast("Settings saved");
          }}
        />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          context={{ email: selected, folder }}
          emails={emails}
          onRunCommand={runCommand}
          onNavigate={(f) => {
            setFolder(f);
            setCustomFolder(null);
          }}
          onSelectEmail={(email) => {
            setCustomFolder(null);
            setFilters(defaultMailFilters);
            setFolder(email.folder);
            setSelectedId(email.id);
            setSelectedIds([]);
          }}
          onOpenSettings={openSettings}
        />
        <ShortcutOverlay open={shortcutOverlayOpen} onClose={() => setShortcutOverlayOpen(false)} />
        <ProofInspectorModal
          open={proofInspectorOpen}
          onClose={() => setProofInspectorOpen(false)}
          emails={emails}
          onOpenMessage={handleOpenMessageFromInspector}
          onShowToast={showToast}
          initialQuery={proofInspectorQuery}
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

        <BottomNavigation
          active={folder}
          onCompose={() => openCompose()}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenCalendar={() => openCalendar()}
          onOpenSettings={openSettings}
          onSelectFolder={(f) => {
            setFolder(f);
            setCustomFolder(null);
          }}
        />
        <FeedbackViewport items={feedbackItems} onDismiss={dismissFeedback} />

        <ContactMigrationDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onComplete={handleImportSave}
          owner={
            emails.find((e) => e.email?.startsWith("G") || e.email?.includes("*"))?.email ?? ""
          }
        />

        <SenderConversionDialog
          target={senderConversion.target}
          onConfirm={handleConvertSender}
          onClose={senderConversion.close}
        />

        <SnoozeDialog
          target={snooze.target}
          initialState={selectedSnoozeState}
          events={calendar.events}
          onConfirm={handleSnooze}
          onClose={snooze.close}
        />

        <AttachmentPreviewDrawer
          isOpen={!!previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          attachment={previewAttachment}
          senderAddress={selected?.email}
        />
      </div>
    </MotionConfig>
  );
}
