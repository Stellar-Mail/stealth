// ---------------------------------------------------------------------------
// BETA-074 (Issue #1981) — code-split non-critical overlay panels.
//
// Compose, calendar, settings, command palette, proof inspector, sender
// conversion, snooze, contact import, attachment preview, and auth are
// loaded as separate async chunks (React.lazy) so they never bloat the
// core mail shell bundle. They stay mounted so their enter/exit animations
// and focus behavior are unchanged.
// ---------------------------------------------------------------------------

import { lazy, Suspense } from "react";

import { BulkConfirmDialog } from "@/components/mail/BulkConfirmDialog";
import type { ComposeSubmission } from "@/components/mail/composeValidation";
import type { BulkActionConfirmation, BulkActionRequest } from "@/components/mail/bulk-actions";
import type { Email, SnoozeState } from "@/components/mail/data";
import type { useCalendar } from "@/features/calendar";
import type { CommandId } from "@/features/command-palette";
import type { SenderConversionTarget, SenderPolicyChoice } from "@/features/sender-conversion";
import type { SnoozeTarget } from "@/features/snooze";
import type { LayoutPreferences, UiPreferences } from "@/features/preferences";
import type { MailFolder } from "@/components/mail/data";
import type { MailOverlays } from "../useMailOverlays";
import type { FeedbackTone } from "@/features/design-system/feedback/use-feedback";

const Compose = lazy(() =>
  import("@/components/mail/Compose").then((m) => ({ default: m.Compose })),
);
const SettingsModal = lazy(() =>
  import("@/components/mail/SettingsModal").then((m) => ({ default: m.SettingsModal })),
);
const CommandPalette = lazy(() =>
  import("@/features/command-palette").then((m) => ({ default: m.CommandPalette })),
);
const ShortcutOverlay = lazy(() =>
  import("@/features/command-palette").then((m) => ({ default: m.ShortcutOverlay })),
);
const ProofInspectorModal = lazy(() =>
  import("@/features/proof-inspector").then((m) => ({ default: m.ProofInspectorModal })),
);
const CalendarWorkspace = lazy(() =>
  import("@/features/calendar").then((m) => ({ default: m.CalendarWorkspace })),
);
const ContactMigrationDialog = lazy(() =>
  import("@/features/contacts").then((m) => ({ default: m.ContactMigrationDialog })),
);
const SenderConversionDialog = lazy(() =>
  import("@/features/sender-conversion").then((m) => ({ default: m.SenderConversionDialog })),
);
const SnoozeDialog = lazy(() =>
  import("@/features/snooze").then((m) => ({ default: m.SnoozeDialog })),
);
const AttachmentPreviewDrawer = lazy(() =>
  import("@/components/mail/AttachmentPreviewDrawer").then((m) => ({
    default: m.AttachmentPreviewDrawer,
  })),
);
const AuthModal = lazy(() =>
  import("@/components/mail/AuthModal").then((m) => ({ default: m.AuthModal })),
);

type CalendarApi = ReturnType<typeof useCalendar>;

export function MailOverlayStack({
  overlays,
  emails,
  selected,
  folder,
  preferences,
  layout,
  setPreferences,
  setLayout,
  resetLayout,
  calendar,
  selectedSnoozeState,
  senderTarget,
  snoozeTarget,
  bulkConfirmation,
  onCancelBulk,
  onConfirmBulk,
  onComposeSubmit,
  onShowToast,
  onRunCommand,
  onNavigate,
  onSelectEmail,
  onOpenSettings,
  onOpenMessage,
  onConvertSender,
  onCloseSenderConversion,
  onConfirmSnooze,
  onCloseSnooze,
  onImportComplete,
  composeOwner,
}: {
  overlays: MailOverlays;
  emails: Email[];
  selected: Email | null;
  folder: MailFolder;
  preferences: UiPreferences;
  layout: LayoutPreferences;
  setPreferences: (preferences: UiPreferences) => void;
  setLayout: (layout: LayoutPreferences) => void;
  resetLayout: () => void;
  calendar: CalendarApi;
  selectedSnoozeState: SnoozeState | undefined;
  senderTarget: SenderConversionTarget | null;
  snoozeTarget: SnoozeTarget | null;
  bulkConfirmation: {
    request: BulkActionRequest;
    confirmation: BulkActionConfirmation;
  } | null;
  onCancelBulk: () => void;
  onConfirmBulk: (request: BulkActionRequest) => void;
  onComposeSubmit: (submission: ComposeSubmission) => void;
  onShowToast: (message: string, options?: { tone: FeedbackTone }) => void;
  onRunCommand: (id: CommandId, email?: Email) => void;
  onNavigate: (folder: MailFolder) => void;
  onSelectEmail: (email: Email) => void;
  onOpenSettings: () => void;
  onOpenMessage: (email: Email) => void;
  onConvertSender: (target: SenderConversionTarget, choice: SenderPolicyChoice) => void;
  onCloseSenderConversion: () => void;
  onConfirmSnooze: (target: SnoozeTarget, state: SnoozeState) => void;
  onCloseSnooze: () => void;
  onImportComplete: (result: {
    writes: number;
    rows: Array<{ name: string; address: string }>;
  }) => void;
  composeOwner: string;
}) {
  return (
    <>
      <BulkConfirmDialog
        confirmation={bulkConfirmation?.confirmation ?? null}
        onCancel={onCancelBulk}
        onConfirm={() => {
          const request = bulkConfirmation?.request;
          onCancelBulk();
          if (request) onConfirmBulk(request);
        }}
      />

      <Suspense fallback={null}>
        <Compose
          open={overlays.composeOpen}
          onClose={() => overlays.setComposeOpen(false)}
          onShowToast={onShowToast}
          initialTo={overlays.composeInitial.to}
          initialSubject={overlays.composeInitial.subject}
          initialBody={overlays.composeInitial.body}
          initialPostage={preferences.minimumPostage}
          onSubmit={onComposeSubmit}
        />
      </Suspense>
      <Suspense fallback={null}>
        <SettingsModal
          open={overlays.settingsOpen}
          onClose={overlays.closeSettings}
          onCancel={() => {
            if (overlays.settingsSnapshot) setPreferences(overlays.settingsSnapshot);
            overlays.closeSettings();
            onShowToast("Settings changes discarded");
          }}
          preferences={preferences}
          onChange={setPreferences}
          layout={layout}
          onLayoutChange={setLayout}
          onResetLayout={resetLayout}
          onSave={() => {
            overlays.setSettingsSnapshot(null);
            onShowToast("Settings saved");
          }}
        />
      </Suspense>
      <Suspense fallback={null}>
        <CommandPalette
          open={overlays.paletteOpen}
          onClose={() => overlays.setPaletteOpen(false)}
          context={{ email: selected, folder }}
          emails={emails}
          onRunCommand={onRunCommand}
          onNavigate={onNavigate}
          onSelectEmail={onSelectEmail}
          onOpenSettings={onOpenSettings}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ShortcutOverlay
          open={overlays.shortcutOverlayOpen}
          onClose={() => overlays.setShortcutOverlayOpen(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ProofInspectorModal
          open={overlays.proofInspectorOpen}
          onClose={() => overlays.setProofInspectorOpen(false)}
          emails={emails}
          onOpenMessage={onOpenMessage}
          onShowToast={onShowToast}
          initialQuery={overlays.proofInspectorQuery}
        />
      </Suspense>
      <Suspense fallback={null}>
        <CalendarWorkspace
          open={overlays.calendarOpen}
          onClose={() => overlays.setCalendarOpen(false)}
          calendars={calendar.calendars}
          events={calendar.events}
          initialEventId={overlays.calendarEventId}
          createRequest={overlays.calendarCreateRequest}
          onSaveEvent={calendar.saveEvent}
          onDeleteEvent={calendar.deleteEvent}
          onDuplicateEvent={calendar.duplicateEvent}
          onResponseChange={calendar.updateResponse}
          onReminderChange={calendar.updateReminder}
          onToggleCalendar={calendar.toggleCalendar}
          onAddCalendar={calendar.addCalendar}
          onShowToast={onShowToast}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ContactMigrationDialog
          open={overlays.importOpen}
          onClose={() => overlays.setImportOpen(false)}
          onComplete={onImportComplete}
          owner={composeOwner}
        />
      </Suspense>
      <Suspense fallback={null}>
        <SenderConversionDialog
          target={senderTarget}
          onConfirm={onConvertSender}
          onClose={onCloseSenderConversion}
        />
      </Suspense>
      <Suspense fallback={null}>
        <SnoozeDialog
          target={snoozeTarget}
          initialState={selectedSnoozeState}
          events={calendar.events}
          onConfirm={onConfirmSnooze}
          onClose={onCloseSnooze}
        />
      </Suspense>
      <Suspense fallback={null}>
        <AttachmentPreviewDrawer
          isOpen={!!overlays.previewAttachment}
          onClose={() => overlays.setPreviewAttachment(null)}
          attachment={overlays.previewAttachment}
          senderAddress={selected?.email}
        />
      </Suspense>
      <Suspense fallback={null}>
        <AuthModal
          open={overlays.authModalOpen}
          onClose={() => overlays.setAuthModalOpen(false)}
          onSuccess={(user) => onShowToast(`Signed in as ${user.username}`)}
        />
      </Suspense>
    </>
  );
}
