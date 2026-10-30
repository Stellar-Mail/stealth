// ---------------------------------------------------------------------------
// BETA-053 (Issue #1960) — mail application shell.
//
// Owns composition of feature hooks (server data, selection, overlays, layout
// preferences) and the existing visual chrome. The root route only mounts this.
// ---------------------------------------------------------------------------

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";

import { AmbientBackground } from "@/components/mail/AmbientBackground";
import { Sidebar } from "@/components/mail/Sidebar";
import { Topbar } from "@/components/mail/Topbar";
import { BottomNavigation } from "@/components/mail/BottomNavigation";
import { EmailList } from "@/components/mail/EmailList";
import { EmailView, type EmailViewActions } from "@/components/mail/EmailView";
import { RightPanel } from "@/components/mail/RightPanel";
import type { Email } from "@/components/mail/data";
import { defaultMailFilters } from "@/components/mail/data";
import { cn } from "@/lib/utils";
import { useIsMobile, useMediaQuery } from "@/lib/use-media-query";
import { useCalendar } from "@/features/calendar";
import { FeedbackViewport } from "@/features/design-system/feedback/feedback-viewport";
import { useFeedback } from "@/features/design-system/feedback/use-feedback";
import { DegradedStateBanner } from "@/features/design-system/feedback/DegradedStateBanner";
import { useLayoutPreferences, usePreferences } from "@/features/preferences";
import { useSenderConversion } from "@/features/sender-conversion";
import { useSnooze } from "@/features/snooze";
import { useNotificationCenter } from "@/features/notifications";

import { useMailActions, quoteBody } from "../useMailActions";
import { useMailBulkActions } from "../useMailBulkActions";
import { useMailCommands } from "../useMailCommands";
import { useMailNavigation } from "../useMailNavigation";
import { useMailOverlays } from "../useMailOverlays";
import { useMailSource } from "../useMailSource";
import { useMailboxDescriptors } from "../useMailbox";
import { useRequests } from "../useRequests";
import { useSession, sessionActor } from "../useSession";
import { useThreadRead } from "../useThreadRead";
import { MailMailboxStatus } from "./MailMailboxStatus";
import { MailOverlayStack } from "./MailOverlayStack";
import { offlineAppFailure } from "@/lib/api";
import { WorkMobileNavigation, WorkSidebar } from "@/features/work/WorkSidebar";
import { canPreviewWork, useWorkSession, type WorkView } from "@/features/work/model";
import { MailToolsRail } from "../tools/MailToolsRail";

// BETA-074 (Issue #1981) — the requests triage board and the sender journey are
// large feature surfaces only shown on demand. Loading them as async chunks
// keeps them out of the initial mail shell bundle.
const RequestsTriageBoard = lazy(() =>
  import("@/features/requests").then((m) => ({ default: m.RequestsTriageBoard })),
);
const SenderJourney = lazy(() =>
  import("@/features/sender-journey").then((m) => ({ default: m.SenderJourney })),
);
const WorkWorkspace = lazy(() =>
  import("@/features/work/WorkWorkspace").then((m) => ({ default: m.WorkWorkspace })),
);

export interface MailAppProps {
  isDemoMode?: boolean;
}

export function MailApp({ isDemoMode = false }: MailAppProps) {
  const session = useSession({ enabled: !isDemoMode });
  const actor = sessionActor(session.data);
  const [workActive, setWorkActive] = useState(false);
  const [workView, setWorkView] = useState<WorkView>("overview");
  const work = useWorkSession(`${isDemoMode ? "demo" : "live"}:${actor ?? "anonymous"}`);
  const workPreviewAllowed = canPreviewWork(isDemoMode, import.meta.env.DEV);
  const showWorkContent = workActive && (!workPreviewAllowed || workView !== "mail");

  const source = useMailSource({ isDemoMode });
  const mailboxDescriptors = useMailboxDescriptors({
    actor: source.actor ?? "anonymous",
    enabled: Boolean(source.actor) && !isDemoMode,
  });
  const requests = useRequests(source.actor, undefined, !isDemoMode);
  const navigation = useMailNavigation(source.emails, source.folderCounts);
  const threadRead = useThreadRead({
    actor: source.actor,
    selectedId: navigation.selectedId,
    emails: source.emails,
    enabled: !isDemoMode,
    isDemoMode,
  });
  const readerEmail = threadRead.readerEmail ?? navigation.selected;
  const overlays = useMailOverlays();
  const { layout, setLayout, resetLayout, hydrated: layoutHydrated } = useLayoutPreferences();
  const { preferences, setPreferences, hydrated: prefHydrated } = usePreferences();
  const notificationCenter = useNotificationCenter({
    actor: source.actor,
    mail: mailboxDescriptors.data?.items ?? [],
    requests: requests.data?.items ?? [],
    preferences: preferences.notifications,
    browserEnabled: preferences.desktopNotifications,
  });
  const senderConversion = useSenderConversion();
  const snooze = useSnooze();
  const isMobile = useIsMobile();
  const isCompactViewport = useMediaQuery("(max-width: 1279px)");
  const showRightPanel = useMediaQuery("(min-width: 1800px)");
  const calendar = useCalendar();
  const { dismiss: dismissFeedback, items: feedbackItems, notify: showToast } = useFeedback();

  const openSenderConversion = useCallback(
    (email: Email) =>
      senderConversion.open({
        emailId: email.id,
        sender: email.from,
        address: email.email,
        currentPolicy: email.senderPolicy,
      }),
    [senderConversion.open],
  );

  const actions = useMailActions({
    emails: source.emails,
    updateEmail: source.updateEmail,
    insertEmail: source.insertEmail,
    trashEmail: source.trashEmail,
    mutateMailbox: source.mutateMailbox,
    showToast,
    openCompose: overlays.openCompose,
    openCalendar: overlays.openCalendar,
    addMailEvent: calendar.addMailEvent,
    calendarEvents: calendar.events,
    updateCalendarResponse: calendar.updateResponse,
    updateCalendarReminder: calendar.updateReminder,
    previewAttachment: overlays.setPreviewAttachment,
    openSenderConversion,
    openSnoozeDialog: (email) => snooze.open({ emailId: email.id, subject: email.subject }),
    closeSnooze: snooze.close,
    isDemoMode,
    actor,
  });

  const bulk = useMailBulkActions({
    selectedEmails: navigation.selectedEmails,
    updateEmail: source.updateEmail,
    trashEmail: source.trashEmail,
    mutateMailbox: source.mutateMailbox,
    onToast: showToast,
    onClearSelection: () => navigation.setSelectedIds([]),
  });

  // Close before mutations so marking unread cannot trigger automatic mark-read again.
  const readerActions: EmailViewActions = {
    ...actions.emailActions,
    onBack: navigation.closeMessage,
    onMarkUnread: (email) => {
      navigation.closeMessage();
      actions.emailActions.onMarkUnread(email);
    },
    onArchive: (email) => {
      navigation.closeMessage();
      actions.emailActions.onArchive(email);
    },
    onTrash: (email) => {
      navigation.closeMessage();
      actions.emailActions.onTrash(email);
    },
    onMove: (email, target) => {
      navigation.closeMessage();
      actions.emailActions.onMove(email, target);
    },
  };

  const { runCommand } = useMailCommands({
    selected: showWorkContent ? null : navigation.selected,
    minimumPostage: preferences.minimumPostage,
    calendarEvents: calendar.events,
    openCompose: overlays.openCompose,
    openCalendar: overlays.openCalendar,
    openSettings: () => overlays.openSettings(preferences),
    openShortcuts: () => overlays.setShortcutOverlayOpen(true),
    togglePalette: () => overlays.setPaletteOpen((open) => !open),
    goFolder: (folder) => {
      navigation.selectFolder(folder);
      setWorkView("mail");
    },
    archive: actions.handleArchive,
    applySender: actions.applySenderCommand,
    quickSnooze: actions.openQuickSnooze,
    showToast,
    updateEmail: source.updateEmail,
    openProofInspector: overlays.openProofInspector,
  });

  useEffect(() => {
    if (!navigation.selectedId) return;
    const current = source.emails.find((email) => email.id === navigation.selectedId);
    if (current?.unread) void source.mutateMailbox(current, { unread: false });
  }, [navigation.selectedId, source.emails, source.mutateMailbox]);

  const handleImportSave = useCallback(
    (result: { writes: number; rows: Array<{ name: string; address: string }> }) => {
      overlays.setImportOpen(false);
      showToast(
        `${result.writes} sender rule${result.writes !== 1 ? "s" : ""} written for ${
          result.rows.length
        } contact${result.rows.length !== 1 ? "s" : ""}`,
      );
    },
    [overlays, showToast],
  );

  const snoozeEmail = source.emails.find((email) => email.id === snooze.target?.emailId) ?? null;
  const selectedSnoozeState = snoozeEmail?.folder === "snoozed" ? snoozeEmail.snooze : undefined;
  const isTest = typeof window !== "undefined" && !!window.navigator.webdriver;
  const blockingSource =
    source.sourceView.kind === "loading" ||
    (source.sourceView.kind === "error" && !source.sourceView.hasCachedData);

  if (overlays.showSenderJourney) {
    return (
      <div className="h-screen">
        <Suspense fallback={null}>
          <SenderJourney />
        </Suspense>
        <button
          onClick={() => overlays.setShowSenderJourney(false)}
          className="fixed top-4 left-4 rounded-lg border border-surface-tint/10 bg-surface-recessed/50 px-4 py-2 text-xs text-foreground dark:text-white/80 hover:bg-surface-recessed/70 z-50"
        >
          Back to app
        </button>
      </div>
    );
  }

  return (
    <MotionConfig transition={isTest ? { duration: 0 } : undefined} reducedMotion="user">
      <div
        data-hydrated={layoutHydrated && prefHydrated}
        className="relative h-screen overflow-hidden text-foreground"
      >
        <a
          href="#main-content"
          className="sr-only absolute left-4 top-4 z-[100] rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          Skip to mailbox
        </a>
        <AmbientBackground />
        <main id="main-content" tabIndex={-1} className="flex h-full w-full">
          {workActive ? (
            <WorkSidebar
              active={workView}
              onSelect={setWorkView}
              onCompose={() => overlays.openCompose()}
              onSettings={() => overlays.openSettings(preferences)}
            />
          ) : !isMobile ? (
            <div
              className={cn(
                "shrink-0 transition-[width] duration-200 ease-out",
                layout.sidebarCollapsed ? "w-[64px]" : "w-[240px]",
              )}
            >
              <Sidebar
                active={navigation.folder}
                counts={navigation.folderCounts}
                onSelect={navigation.selectFolder}
                collapsed={layout.sidebarCollapsed}
                onToggle={() => setLayout({ sidebarCollapsed: !layout.sidebarCollapsed })}
                onCompose={() => overlays.openCompose()}
                customFolder={navigation.customFolder}
                onSelectCustomFolder={navigation.setCustomFolder}
              />
            </div>
          ) : (
            <Sidebar
              active={navigation.folder}
              counts={navigation.folderCounts}
              onSelect={navigation.selectFolder}
              collapsed={layout.sidebarCollapsed}
              onToggle={() => setLayout({ sidebarCollapsed: !layout.sidebarCollapsed })}
              onCompose={() => overlays.openCompose()}
              customFolder={navigation.customFolder}
              onSelectCustomFolder={navigation.setCustomFolder}
            />
          )}

          <div className="flex min-w-0 flex-1">
            <div
              className={cn(
                "flex h-full flex-col min-w-0 md:pb-0 focus:outline-none flex-1",
                !workActive && "pb-[72px]",
              )}
            >
              <Topbar
                onOpenPalette={() => overlays.setPaletteOpen(true)}
                onOpenSettings={() => overlays.openSettings(preferences)}
                onOpenProofInspector={() => runCommand("open-proof-inspector")}
                onOpenShortcuts={() => overlays.setShortcutOverlayOpen(true)}
                onImportContacts={() => overlays.setImportOpen(true)}
                onShowToast={showToast}
                filters={navigation.filters}
                onFiltersChange={navigation.setFilters}
                onViewNotifications={() => {
                  navigation.setCustomFolder(null);
                  navigation.setFolder("inbox");
                  navigation.setFilters({ ...defaultMailFilters, unreadOnly: true });
                }}
                onOpenLogin={() => overlays.setAuthModalOpen(true)}
                notifications={notificationCenter.notifications}
                onMarkNotificationRead={notificationCenter.markRead}
                onMarkAllNotificationsRead={notificationCenter.markAllRead}
                actor={source.actor}
                onSelectContact={(address) => overlays.openCompose({ to: address })}
                emails={source.emails}
                onSelectEmail={(id, folder) => {
                  setWorkView("mail");
                  if (folder) navigation.setFolder(folder as any);
                  const email = source.emails.find((item) => item.id === id);
                  if (email) {
                    navigation.openMessage(email);
                  } else {
                    navigation.setSelectedId(id);
                  }
                }}
                workActive={workActive}
                onToggleWork={() => setWorkActive((active) => !active)}
              />
              {workActive && (
                <WorkMobileNavigation
                  active={workView}
                  onSelect={setWorkView}
                  onCompose={() => overlays.openCompose()}
                />
              )}
              <div className="flex min-h-0 flex-1">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  {showWorkContent && (
                    <Suspense
                      fallback={
                        <p role="status" className="p-8 text-sm text-muted-foreground">
                          Opening Work...
                        </p>
                      }
                    >
                      <WorkWorkspace
                        view={workView}
                        emails={source.emails}
                        events={calendar.visibleEvents}
                        session={work.session}
                        update={work.update}
                        previewAllowed={workPreviewAllowed}
                        onSelect={setWorkView}
                        onExit={() => setWorkActive(false)}
                        onOpenCalendar={overlays.openCalendar}
                        onOpenEmail={(email) => {
                          navigation.openMessage(email);
                          setWorkView("mail");
                        }}
                      />
                    </Suspense>
                  )}
                  {source.connectivity.paused &&
                  source.sourceView.kind !== "error" &&
                  !blockingSource ? (
                    <DegradedStateBanner
                      failure={offlineAppFailure()}
                      compact
                      onRetry={() => void source.retry()}
                    />
                  ) : null}
                  {source.sourceView.kind === "error" && source.sourceView.hasCachedData ? (
                    <MailMailboxStatus
                      view={source.sourceView}
                      compact
                      onRetry={() => void source.retry()}
                      onSignIn={() => overlays.setAuthModalOpen(true)}
                    />
                  ) : null}
                  <div
                    hidden={showWorkContent}
                    className={cn("min-h-0 min-w-0 flex-1", showWorkContent ? "hidden" : "flex")}
                  >
                    {blockingSource ? (
                      <MailMailboxStatus
                        view={source.sourceView}
                        onRetry={() => void source.retry()}
                        onSignIn={() => overlays.setAuthModalOpen(true)}
                      />
                    ) : navigation.folder === "requests" ? (
                      <Suspense fallback={null}>
                        <RequestsTriageBoard
                          emails={source.emails}
                          onUpdateEmail={source.updateEmail}
                          onShowToast={showToast}
                          isDemoMode={isDemoMode}
                        />
                      </Suspense>
                    ) : (
                      <div className="flex h-full w-full min-w-0">
                        {isMobile ? (
                          navigation.mobileView === "reader" && readerEmail ? (
                            <div className="min-w-0 flex-1 w-full h-full">
                              <EmailView
                                email={readerEmail}
                                thread={threadRead.thread}
                                threadView={threadRead.view}
                                onRetryThread={() => {
                                  void threadRead.retry();
                                }}
                                actions={readerActions}
                                criticalAlerts={preferences.criticalAlerts}
                                onBack={navigation.closeMessage}
                              />
                            </div>
                          ) : (
                            <div className="min-w-0 w-full h-full">
                              <EmailList
                                emails={source.emails}
                                selectedId={navigation.selectedId}
                                onSelect={(id) => {
                                  navigation.setSelectedId(id);
                                  navigation.setMobileView("reader");
                                }}
                                folder={navigation.folder}
                                filters={navigation.filters}
                                customFolder={navigation.customFolder}
                                showAvatars
                                criticalAlerts={preferences.criticalAlerts}
                                useMobile={true}
                                onArchive={actions.handleArchive}
                                onStar={actions.handleStar}
                                onSnooze={(email) =>
                                  snooze.open({ emailId: email.id, subject: email.subject })
                                }
                                onMove={actions.handleMove}
                                hasMore={source.hasMore}
                                onLoadMore={() => {
                                  void source.loadMore();
                                }}
                                isLoadingMore={source.isLoadingMore}
                              />
                            </div>
                          )
                        ) : (
                          <>
                            <div
                              className={cn(
                                "min-w-0",
                                layout.compactMode || preferences.compactMode || isCompactViewport
                                  ? "w-[320px] shrink-0"
                                  : "w-[360px] shrink-0",
                              )}
                            >
                              <EmailList
                                emails={source.emails}
                                selectedId={navigation.selectedId}
                                onSelect={navigation.setSelectedId}
                                folder={navigation.folder}
                                filters={navigation.filters}
                                customFolder={navigation.customFolder}
                                showAvatars
                                criticalAlerts={preferences.criticalAlerts}
                                useMobile={false}
                                onArchive={actions.handleArchive}
                                onStar={actions.handleStar}
                                onSnooze={(email) =>
                                  snooze.open({ emailId: email.id, subject: email.subject })
                                }
                                onMove={actions.handleMove}
                                hasMore={source.hasMore}
                                onLoadMore={() => {
                                  void source.loadMore();
                                }}
                                isLoadingMore={source.isLoadingMore}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <EmailView
                                email={readerEmail}
                                thread={threadRead.thread}
                                threadView={threadRead.view}
                                onRetryThread={() => {
                                  void threadRead.retry();
                                }}
                                actions={readerActions}
                                criticalAlerts={preferences.criticalAlerts}
                              />
                            </div>
                            {showRightPanel && (
                              <div className="w-[320px] shrink-0">
                                <RightPanel
                                  email={readerEmail}
                                  onAction={actions.handleContextAction}
                                  onConvertSender={openSenderConversion}
                                  onSnooze={(email) =>
                                    snooze.open({ emailId: email.id, subject: email.subject })
                                  }
                                  calendarEvents={calendar.visibleEvents}
                                  calendars={calendar.calendars}
                                  onShowToast={showToast}
                                  onOpenCalendar={overlays.openCalendar}
                                  onCreateEvent={overlays.requestCalendarCreate}
                                  onDraftReply={(email, prompt) =>
                                    overlays.openCompose({
                                      to: email.email,
                                      subject: email.subject.startsWith("Re: ")
                                        ? email.subject
                                        : `Re: ${email.subject}`,
                                      body: `${prompt}\n\nDrafted response:\nThanks for the note. I reviewed the context and will follow up with the next step shortly.${quoteBody(
                                        email,
                                      )}`,
                                    })
                                  }
                                  onPreviewAttachment={(attachment) =>
                                    overlays.setPreviewAttachment(attachment)
                                  }
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <MailToolsRail
                  key={`${isDemoMode ? "demo" : "live"}:${source.actor ?? "anonymous"}:${workActive}`}
                  actor={isDemoMode ? null : source.actor}
                  emails={source.emails}
                  selected={readerEmail}
                  events={calendar.visibleEvents}
                  workEnabled={workActive && workPreviewAllowed}
                  session={work.session}
                  update={work.update}
                  onOpenCalendar={overlays.openCalendar}
                  onOpenEmail={(email) => {
                    navigation.openMessage(email);
                    setWorkView("mail");
                  }}
                  onCompose={(address) => overlays.openCompose({ to: address })}
                  onImportContacts={() => overlays.setImportOpen(true)}
                  onToggleSaved={actions.handleStar}
                  onSnooze={(email) => snooze.open({ emailId: email.id, subject: email.subject })}
                  onOpenProofInspector={() => overlays.openProofInspector()}
                />
              </div>
            </div>
          </div>
        </main>

        <MailOverlayStack
          overlays={overlays}
          emails={source.emails}
          selected={readerEmail}
          folder={navigation.folder}
          preferences={preferences}
          layout={layout}
          setPreferences={(next) => setPreferences(next)}
          setLayout={(next) => setLayout(next)}
          resetLayout={resetLayout}
          calendar={calendar}
          selectedSnoozeState={selectedSnoozeState}
          senderTarget={senderConversion.target}
          snoozeTarget={snooze.target}
          bulkConfirmation={bulk.bulkConfirmation}
          onCancelBulk={() => bulk.setBulkConfirmation(null)}
          onConfirmBulk={(request) => void bulk.runBulkAction(request)}
          onComposeSubmit={actions.handleComposeSubmit}
          onShowToast={showToast}
          onRunCommand={runCommand}
          onNavigate={navigation.selectFolder}
          onSelectEmail={navigation.openMessage}
          onOpenSettings={() => overlays.openSettings(preferences)}
          onOpenMessage={navigation.openMessage}
          onConvertSender={actions.handleConvertSender}
          onCloseSenderConversion={senderConversion.close}
          onConfirmSnooze={actions.handleSnooze}
          onCloseSnooze={snooze.close}
          onImportComplete={handleImportSave}
          composeOwner={
            source.emails.find(
              (email) => email.email?.startsWith("G") || email.email?.includes("*"),
            )?.email ?? ""
          }
          actor={source.actor}
          offline={isDemoMode || !source.actor}
        />

        {!workActive && (
          <BottomNavigation
            active={navigation.folder}
            onCompose={() => overlays.openCompose()}
            onOpenPalette={() => overlays.setPaletteOpen(true)}
            onOpenCalendar={() => overlays.openCalendar()}
            onOpenSettings={() => overlays.openSettings(preferences)}
            onSelectFolder={navigation.selectFolder}
          />
        )}
        <FeedbackViewport items={feedbackItems} onDismiss={dismissFeedback} />
      </div>
    </MotionConfig>
  );
}
