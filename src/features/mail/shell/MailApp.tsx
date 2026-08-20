// ---------------------------------------------------------------------------
// BETA-053 (Issue #1960) — mail application shell.
//
// Owns composition of feature hooks (server data, selection, overlays, layout
// preferences) and the existing visual chrome. The root route only mounts this.
// ---------------------------------------------------------------------------

import { useCallback, useEffect } from "react";
import { MotionConfig } from "framer-motion";

import { AmbientBackground } from "@/components/mail/AmbientBackground";
import { Sidebar } from "@/components/mail/Sidebar";
import { Topbar } from "@/components/mail/Topbar";
import { BottomNavigation } from "@/components/mail/BottomNavigation";
import { EmailList } from "@/components/mail/EmailList";
import { EmailView } from "@/components/mail/EmailView";
import { RightPanel } from "@/components/mail/RightPanel";
import type { Email } from "@/components/mail/data";
import { defaultMailFilters } from "@/components/mail/data";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-media-query";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useCalendar } from "@/features/calendar";
import { FeedbackViewport } from "@/features/design-system/feedback/feedback-viewport";
import { useFeedback } from "@/features/design-system/feedback/use-feedback";
import { useLayoutPreferences, usePreferences } from "@/features/preferences";
import { RequestsTriageBoard } from "@/features/requests";
import { SenderJourney } from "@/features/sender-journey";
import { useSenderConversion } from "@/features/sender-conversion";
import { useSnooze } from "@/features/snooze";

import { useMailActions, quoteBody } from "../useMailActions";
import { useMailBulkActions } from "../useMailBulkActions";
import { useMailCommands } from "../useMailCommands";
import { useMailNavigation } from "../useMailNavigation";
import { useMailOverlays } from "../useMailOverlays";
import { useMailSource } from "../useMailSource";
import { useThreadRead } from "../useThreadRead";
import { MailMailboxStatus } from "./MailMailboxStatus";
import { MailOverlayStack } from "./MailOverlayStack";

export interface MailAppProps {
  isDemoMode?: boolean;
}

export function MailApp({ isDemoMode = false }: MailAppProps) {
  const source = useMailSource({ isDemoMode });
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
  const senderConversion = useSenderConversion();
  const snooze = useSnooze();
  const isMobile = useIsMobile();
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
  });

  const bulk = useMailBulkActions({
    selectedEmails: navigation.selectedEmails,
    updateEmail: source.updateEmail,
    trashEmail: source.trashEmail,
    mutateMailbox: source.mutateMailbox,
    onToast: showToast,
    onClearSelection: () => navigation.setSelectedIds([]),
  });

  const { runCommand } = useMailCommands({
    selected: navigation.selected,
    minimumPostage: preferences.minimumPostage,
    calendarEvents: calendar.events,
    openCompose: overlays.openCompose,
    openCalendar: overlays.openCalendar,
    openSettings: () => overlays.openSettings(preferences),
    openShortcuts: () => overlays.setShortcutOverlayOpen(true),
    togglePalette: () => overlays.setPaletteOpen((open) => !open),
    goFolder: navigation.selectFolder,
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
        <SenderJourney />
        <button
          onClick={() => overlays.setShowSenderJourney(false)}
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
                  active={navigation.folder}
                  counts={navigation.folderCounts}
                  onSelect={navigation.selectFolder}
                  collapsed={layout.sidebarCollapsed}
                  onToggle={() => setLayout({ sidebarCollapsed: !layout.sidebarCollapsed })}
                  onCompose={() => overlays.openCompose()}
                  customFolder={navigation.customFolder}
                  onSelectCustomFolder={navigation.setCustomFolder}
                  onOpenSenderJourney={() => overlays.setShowSenderJourney(true)}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          {isMobile && (
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

          <ResizablePanel defaultSize={isMobile ? 100 : 100 - layout.sidebarWidth}>
            <div className="flex h-full flex-col min-w-0 pb-[72px] md:pb-0">
              <Topbar
                onOpenPalette={() => overlays.setPaletteOpen(true)}
                onOpenSettings={() => overlays.openSettings(preferences)}
                onOpenProofInspector={() => runCommand("open-proof-inspector")}
                onOpenShortcuts={() => overlays.setShortcutOverlayOpen(true)}
                onImportContacts={() => overlays.setImportOpen(true)}
                onShowToast={showToast}
                filters={navigation.filters}
                onFiltersChange={navigation.setFilters}
                onQuickAction={(action) => {
                  navigation.setCustomFolder(null);
                  if (action === "proofs") navigation.setFolder("pending");
                  if (action === "later") navigation.setFolder("snoozed");
                  if (action === "files") {
                    navigation.setFolder("all");
                    navigation.setFilters({ ...defaultMailFilters, hasAttachments: true });
                  }
                }}
                onViewNotifications={() => {
                  navigation.setCustomFolder(null);
                  navigation.setFolder("inbox");
                  navigation.setFilters({ ...defaultMailFilters, unreadOnly: true });
                }}
                onOpenLogin={() => overlays.setAuthModalOpen(true)}
              />
              {source.sourceView.kind === "error" && source.sourceView.hasCachedData ? (
                <MailMailboxStatus
                  view={source.sourceView}
                  compact
                  onRetry={() => void source.retry()}
                  onSignIn={() => overlays.setAuthModalOpen(true)}
                />
              ) : null}
              <div className="flex min-h-0 min-w-0 flex-1">
                {blockingSource ? (
                  <MailMailboxStatus
                    view={source.sourceView}
                    onRetry={() => void source.retry()}
                    onSignIn={() => overlays.setAuthModalOpen(true)}
                  />
                ) : navigation.folder === "requests" ? (
                  <RequestsTriageBoard
                    emails={source.emails}
                    onUpdateEmail={source.updateEmail}
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
                        emails={source.emails}
                        selectedId={navigation.selectedId}
                        selectedIds={navigation.selectedIds}
                        onSelect={navigation.setSelectedId}
                        onSelectionChange={navigation.setSelectedIds}
                        onBulkAction={bulk.handleBulkActionRequest}
                        bulkProgress={bulk.bulkProgress}
                        bulkFailures={bulk.bulkFailures}
                        onConvertSender={openSenderConversion}
                        folder={navigation.folder}
                        filters={navigation.filters}
                        customFolder={navigation.customFolder}
                        compact={layout.compactMode || preferences.compactMode}
                        showAvatars={preferences.showAvatars}
                        useMobile={isMobile}
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
                    </ResizablePanel>
                    {!isMobile && (
                      <>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={layout.readerWidth} minSize={30}>
                          <EmailView
                            email={readerEmail}
                            thread={threadRead.thread}
                            threadView={threadRead.view}
                            onRetryThread={() => {
                              void threadRead.retry();
                            }}
                            actions={actions.emailActions}
                          />
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
                        </ResizablePanel>
                      </>
                    )}
                  </ResizablePanelGroup>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

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
        />

        <BottomNavigation
          active={navigation.folder}
          onCompose={() => overlays.openCompose()}
          onOpenPalette={() => overlays.setPaletteOpen(true)}
          onOpenCalendar={() => overlays.openCalendar()}
          onOpenSettings={() => overlays.openSettings(preferences)}
          onSelectFolder={navigation.selectFolder}
        />
        <FeedbackViewport items={feedbackItems} onDismiss={dismissFeedback} />
      </div>
    </MotionConfig>
  );
}
