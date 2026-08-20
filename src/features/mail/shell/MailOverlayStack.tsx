import { BulkConfirmDialog } from "@/components/mail/BulkConfirmDialog";
import { Compose } from "@/components/mail/Compose";
import { SettingsModal } from "@/components/mail/SettingsModal";
import { AttachmentPreviewDrawer } from "@/components/mail/AttachmentPreviewDrawer";
import { AuthModal } from "@/components/mail/AuthModal";
import type { ComposeSubmission } from "@/components/mail/composeValidation";
import type { BulkActionConfirmation, BulkActionRequest } from "@/components/mail/bulk-actions";
import type { Email, SnoozeState } from "@/components/mail/data";
import { CalendarWorkspace, useCalendar } from "@/features/calendar";
import { CommandPalette, ShortcutOverlay, type CommandId } from "@/features/command-palette";
import { ContactMigrationDialog } from "@/features/contacts";
import {
  SenderConversionDialog,
  type SenderConversionTarget,
  type SenderPolicyChoice,
} from "@/features/sender-conversion";
import { SnoozeDialog, type SnoozeTarget } from "@/features/snooze";
import { ProofInspectorModal } from "@/features/proof-inspector";
import type { LayoutPreferences, UiPreferences } from "@/features/preferences";
import type { MailFolder } from "@/components/mail/data";
import type { MailOverlays } from "../useMailOverlays";
import type { FeedbackTone } from "@/features/design-system/feedback/use-feedback";

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
      <ShortcutOverlay
        open={overlays.shortcutOverlayOpen}
        onClose={() => overlays.setShortcutOverlayOpen(false)}
      />
      <ProofInspectorModal
        open={overlays.proofInspectorOpen}
        onClose={() => overlays.setProofInspectorOpen(false)}
        emails={emails}
        onOpenMessage={onOpenMessage}
        onShowToast={onShowToast}
        initialQuery={overlays.proofInspectorQuery}
      />
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
      <ContactMigrationDialog
        open={overlays.importOpen}
        onClose={() => overlays.setImportOpen(false)}
        onComplete={onImportComplete}
        owner={composeOwner}
      />
      <SenderConversionDialog
        target={senderTarget}
        onConfirm={onConvertSender}
        onClose={onCloseSenderConversion}
      />
      <SnoozeDialog
        target={snoozeTarget}
        initialState={selectedSnoozeState}
        events={calendar.events}
        onConfirm={onConfirmSnooze}
        onClose={onCloseSnooze}
      />
      <AttachmentPreviewDrawer
        isOpen={!!overlays.previewAttachment}
        onClose={() => overlays.setPreviewAttachment(null)}
        attachment={overlays.previewAttachment}
        senderAddress={selected?.email}
      />
      <AuthModal
        open={overlays.authModalOpen}
        onClose={() => overlays.setAuthModalOpen(false)}
        onSuccess={(user) => onShowToast(`Signed in as ${user.username}`)}
      />
    </>
  );
}
