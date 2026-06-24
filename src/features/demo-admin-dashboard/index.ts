export { DemoAdminDashboard } from "./DemoAdminDashboard";
export { DemoAdminDashboard as DemoAdminLayoutDashboard } from "./components/DemoAdminDashboard";
export {
  ADMIN_DASHBOARD_MIN_SUPPORTED_WIDTH,
  getAdminDashboardBreakpoint,
  getAdminDashboardWidthNote,
  isAdminDashboardWidthSupported,
} from "./layout";
export type { PayloadDescriptor, PayloadDescriptorKind } from "./types/payloadDescriptor";
export {
  PAYLOAD_DESCRIPTOR_CATALOG,
  getPayloadDescriptorCatalog,
  getPayloadDescriptorsByKind,
} from "./fixtures/payloadDescriptorCatalog";

export {
  adminDashboardLayoutChecks,
  adminDashboardPanels,
  adminDashboardWidthNotes,
} from "./fixtures/demoData";

export { defaultCampaignSnapshots } from "./fixtures/campaignSnapshotFixtures";
export { defaultCampaignTags } from "./fixtures/campaignTagFixtures";
export {
  getSenderRecoveryOutcomeSummary,
  senderRecoveryCampaignPreset,
  senderRecoveryRequestStates,
  validateSenderRecoveryCampaignPreset,
} from "./fixtures/senderRecoveryCampaignPreset";
export type {
  SenderRecoveryRequestState,
  SenderRecoveryRequestStatus,
} from "./fixtures/senderRecoveryCampaignPreset";

export type {
  AdminDashboardBreakpoint,
  AdminDashboardLayoutCheck,
  AdminDashboardPanel,
  AdminDashboardWidthNote,
  DashboardNavItem,
  DashboardSection,
  DemoAdminDashboardProps,
  StatCard,
  PresetAttachment,
  PresetEvent,
} from "./types";

export type { CampaignSnapshot } from "./types/campaignSnapshot";
export type { CampaignTag, TagColorKey } from "./types/campaignTag";

export type {
  DemoAttachment,
  DemoCalendarEvent,
  DemoDataset,
  DemoMessage,
  DemoProofRecord,
  DemoSender,
} from "./types/dataset";

export {
  CAMPAIGN_STATUS_TOKENS,
  TAG_COLOR_TOKENS,
  AUDIENCE_BADGE_TOKENS,
  getTagToken,
  getAudienceToken,
} from "./constants/displayTokens";

export { CampaignTagManager } from "./components/CampaignTagManager";
export { CampaignEditorPanel } from "./components/CampaignEditorPanel";
export type { CampaignEditorPanelProps } from "./components/CampaignEditorPanel";
export { MockPublishPanel } from "./components/MockPublishPanel";
export type { MockPublishPanelProps } from "./components/MockPublishPanel";
export { CampaignDiffPanel } from "./components/CampaignDiffPanel";
export type { CampaignDiffPanelProps } from "./components/CampaignDiffPanel";
export {
  buildCampaignListRows,
  clearCampaignSelection,
  defaultCampaignListSort,
  nextCampaignListSort,
  selectAllCampaigns,
  summarizeCampaignSelection,
  toggleCampaignSelection,
} from "./campaignListTable";
export type {
  CampaignListRow,
  CampaignListSelectionSummary,
  CampaignListSort,
  CampaignListSortDirection,
  CampaignListSortKey,
} from "./campaignListTable";
export {
  campaignEditorStateToSnapshot,
  campaignToEditorState,
  emptyCampaignEditorState,
  getCampaignEditorEmptyState,
  hasAnyCampaignEditorContent,
  normalizeCampaignEditorTags,
  validateCampaignEditorState,
} from "./campaignEditor";
export type {
  CampaignEditorEmptyState,
  CampaignEditorState,
  CampaignEditorStatus,
  CampaignEditorValidationResult,
} from "./campaignEditor";
export {
  canRetryMockPublish,
  canRollbackMockPublish,
  canStartMockPublish,
  getMockPublishSummary,
  initialMockPublishState,
  mockPublishReducer,
} from "./mockPublishWorkflow";
export type {
  MockPublishAction,
  MockPublishState,
  MockPublishStatus,
  MockPublishStep,
} from "./mockPublishWorkflow";
export {
  compareCampaignSnapshots,
  formatCampaignDiffSummary,
  getCampaignDiffEntriesByKind,
  summarizeCampaignDiff,
} from "./campaignDiff";
export type {
  CampaignDiffEntry,
  CampaignDiffKind,
  CampaignDiffResult,
  CampaignDiffSection,
  CampaignDiffSummary,
} from "./campaignDiff";

export {
  createTag,
  renameTag,
  updateTagColor,
  mergeTag,
  deleteTag,
  getTagUsageCount,
} from "./utils/tagOperations";

export {
  normalizeTagName,
  toTagSlug,
  resolveTagSlug,
  normalizeTagColor,
  assignTagOrders,
  normalizeCampaignTag,
  normalizeCampaignTags,
} from "./utils/tagNormalization";

export {
  saveCampaignTags,
  loadCampaignTags,
  clearCampaignTags,
} from "./persistence/localStorageAdapter";

export {
  TemplatePicker,
  messageTemplates,
  searchTemplates,
  templateToDraft,
  isTemplateInserted,
  insertTemplate,
  removeDraft,
  TEMPLATE_CATEGORY_LABEL,
  type InsertResult,
  type MessageTemplate,
  type TemplateCategory,
} from "./templates";

export type { CampaignSeedExample, CampaignSeedScenario } from "./types/campaignSeed";
export {
  campaignSeedExamples,
  getCampaignSeedExamplesByCategory,
  getCampaignSeedExamplesByTag,
} from "./seed-data/campaignSeedExamples";
export {
  isSafeDemoRecipient,
  toCampaignSeedSlug,
  validateCampaignSeedScenario,
} from "./seed-helpers/campaignSeed";

export * from "./validation-types";
export * from "./validation";
export * from "./validationFixtures";
export { ValidationResultsPanel } from "./ValidationResultsPanel";
export type { ValidationResultsPanelProps } from "./ValidationResultsPanel";

// Proof record editor, helpers, and formatting
export { ProofRecordEditor } from "./ProofRecordEditor";
export type { ProofRecordEditorProps } from "./ProofRecordEditor";
export type {
  ProofPostageStatus,
  ProofRecord,
  ProofRecordDraft,
  ProofRecordFieldError,
  ProofRecordValidationResult,
} from "./types/proofRecord";
export {
  mockMessageHash,
  mockPaymentHash,
  mockDiagnosticId,
  mockSignature,
} from "./mockHashHelpers";
export {
  saveAssignments,
  loadAssignments,
  clearAssignments,
} from "./persistence/localStorageAdapter";

export { messagePool, defaultAssignmentState } from "./fixtures/assignmentFixtures";

export type { AudienceSegment, AudienceSegmentId } from "./types/audienceSegment";
export {
  defaultAudienceSegments,
  AUDIENCE_SEGMENTS_BY_ID,
  audienceSegmentSnapshots,
} from "./fixtures/audienceSegmentFixtures";
export { getSegmentById, resolveSegmentLabel, getSegmentToken } from "./utils/segmentHelpers";
export { AUDIENCE_SEGMENT_TOKENS } from "./constants/displayTokens";
export {
  SnoozeMetadataEditor,
  snoozedDemoMessages,
  SNOOZE_PRESETS,
  getSnoozePreset,
  resolvePreset,
  toLocalStamp,
  validateCustomSnooze,
  relativeDayLabel,
  formatRemindAt,
  metadataFromPreset,
  metadataFromCustom,
  DEMO_REFERENCE_NOW,
  getDemoNow,
  type SnoozePreset,
  type CustomSnoozeValidation,
  type SnoozeChoice,
  type SnoozeMetadata,
  type SnoozePresetId,
  type SnoozedDemoMessage,
} from "./snooze";

export type { SenderPolicy, SenderPersona } from "./senderPersonas/types";
export { defaultSenderPersonas } from "./senderPersonas/senderPersonaFixtures";
export { SenderPersonaSelector } from "./senderPersonas/SenderPersonaSelector";
export { SenderPersonaEditor } from "./senderPersonas/SenderPersonaEditor";
export { validateSenderPersona } from "./senderPersonas/validation";

export {
  POSTAGE_STATUS_LABEL,
  truncateHash,
  formatLatency,
  formatPostageStatus,
  isValidMockHash,
  isValidDiagnosticId,
  formatProofSummary,
  validateProofRecord,
} from "./proofFormatting";
export { demoProofRecords } from "./fixtures/proofRecordFixtures";

// Campaign Timeline panel (issue #261)
export { CampaignTimelinePanel } from "./components/CampaignTimelinePanel";
export { isOverdue, isImminent } from "./components/CampaignTimelinePanel";

// Campaign Timeline (issue #260): types, fixtures, helpers, display tokens.
export type {
  CampaignPhase,
  CampaignPhaseKind,
  CampaignPhaseStatus,
  CampaignTimeline,
  Milestone,
  MilestoneKind,
  MilestoneStatus,
  PreviewWindow,
  ScheduledSend,
  ScheduledSendStatus,
} from "./types/campaignTimeline";
export { activeCampaignTimeline, draftCampaignTimeline } from "./fixtures/campaignTimelineFixtures";
export {
  getActivePhase,
  getPhaseForDate,
  getPhaseDurationDays,
  getSendsInWindow,
  getTimelineDateRange,
  getUpcomingMilestones,
  isDateInPhase,
  sortPhasesByStartDate,
  validateCampaignTimeline,
  validateMilestones,
  validatePhases,
  validatePreviewWindows,
  validateScheduledSends,
} from "./utils/campaignTimelineHelpers";
export {
  CAMPAIGN_PHASE_TOKENS,
  getMilestoneToken,
  getMilestoneStatusToken,
  getPhaseToken,
  getSendStatusToken,
  MILESTONE_KIND_TOKENS,
  MILESTONE_STATUS_TOKENS,
  SCHEDULED_SEND_STATUS_TOKENS,
} from "./constants/displayTokens";

// Draft dataset admin store (issue #172): reducer, selectors, hook, types, fixture.
export { draftDatasetReducer, initialDraftDatasetState } from "./reducers/draftDatasetReducer";
export {
  adminEditHistoryReducer,
  canRedoAdminEdit,
  canUndoAdminEdit,
  createAdminEditHistory,
  summarizeAdminEditHistory,
} from "./reducers/historyReducer";
export type {
  AdminEditHistoryAction,
  AdminEditHistoryState,
  AdminEditHistorySummary,
} from "./reducers/historyReducer";
export {
  selectAllDrafts,
  selectDraftById,
  selectDraftCount,
  selectFilteredDrafts,
  selectIsEmpty,
  selectSelectedDraft,
} from "./selectors/draftDatasetSelectors";
export { useDraftDataset } from "./hooks/useDraftDataset";
export type { UseDraftDatasetResult } from "./hooks/useDraftDataset";
export type { DraftDatasetAction, DraftDatasetState } from "./types/draftDataset";
export { draftDatasetSample } from "./fixtures/draftDatasetFixtures";
export {
  emptyBulkSelection,
  normalizeSelectedDraftIds,
  getBulkSelectionSummary,
  selectAllDrafts as selectAllBulkDrafts,
  clearBulkSelection,
  selectDraftRange,
  updateBulkSelection,
  invertBulkSelection,
  formatBulkSelectionSummary,
} from "./bulkSelection";
export type { BulkSelectionMode, BulkSelectionState, BulkSelectionSummary } from "./bulkSelection";
export { BulkSelectionToolbar } from "./components/BulkSelectionToolbar";
export type { BulkSelectionToolbarProps } from "./components/BulkSelectionToolbar";

// Draft dataset JSON export (issue #190): serializer, filename builder, button.
export {
  buildDatasetExport,
  serializeDraftDataset,
  serializeDraftDatasetState,
  buildExportFilename,
} from "./helpers/datasetExport";
export { DATASET_EXPORT_SCHEMA_VERSION } from "./types/datasetExport";
export type { DraftDatasetExport } from "./types/datasetExport";
export { ExportDatasetButton } from "./components/ExportDatasetButton";
export type { ExportDatasetButtonProps } from "./components/ExportDatasetButton";

// Campaign KPI definitions (issue #262): types, fixtures, helpers, display tokens.
export type {
  CampaignKpiDefinition,
  KpiMetricKind,
  KpiStatus,
  KpiTrend,
  KpiUnit,
} from "./types/campaignKpi";
export { CAMPAIGN_KPI_DEFINITIONS } from "./fixtures/campaignKpiFixtures";
export {
  computeKpiProgress,
  formatKpiTrend,
  getKpiById,
  getKpisForCampaign,
  isKpiMet,
  sortKpisByMetric,
  validateCampaignKpiDefinition,
} from "./utils/campaignKpiHelpers";
export {
  KPI_METRIC_TOKENS,
  KPI_STATUS_TOKENS,
  KPI_TREND_TOKENS,
  getKpiMetricToken,
  getKpiStatusToken,
  getKpiTrendToken,
} from "./constants/displayTokens";

// Campaign analytics preview cards (issue #264)
export { CampaignAnalyticsCard } from "./components/CampaignAnalyticsCard";
export { CampaignAnalyticsPanel } from "./components/CampaignAnalyticsPanel";

export {
  MESSAGE_FOLDERS,
  DEFAULT_MESSAGE_FOLDER,
  MESSAGE_FIELDS,
  getMessageField,
  createEmptyMessage,
} from "./constants/messageListEditorModel";
export type {
  MessageFolder,
  MessageFieldKey,
  MessageFieldType,
  EditableMessage,
  MessageFieldMeta,
} from "./constants/messageListEditorModel";
export { messageListFixtures } from "./fixtures/messageListFixtures";

// Inbox seed dataset (issue #6): fixtures, metadata, helpers, validation
export { inboxSeedDataset, inboxSeedMessages, inboxSeedSenders } from "./fixtures/inboxSeedDataset";
export {
  inboxSeedMetadata,
  inboxSeedFolderMap,
  inboxSeedFolderCounts,
} from "./fixtures/inboxSeedMetadata";
export type { InboxSeedMetadata } from "./fixtures/inboxSeedMetadata";
export {
  getMessagesByLabel,
  getMessagesBySender,
  getMessagesByProofStatus,
  getMessagesByFolder,
  getUnreadMessages,
  getStarredMessages,
  getMessagesWithAttachments,
  getMessagesWithCalendarEvent,
  getSnoozedMessages,
  getTrustedSenders,
  getUntrustedSenders,
  getRelaySenders,
  collectLabels,
  computeFolderDistribution,
  findMessageById,
  findSenderByAddress,
} from "./utils/inboxSeedHelpers";
export { validateInboxSeedDataset } from "./seedDatasetValidation";
export { getSeedDatasetPreview } from "./utils/seedDatasetPreview";
export type { SeedDatasetPreview } from "./utils/seedDatasetPreview";
export {
  DEMO_FOLDERS,
  MAILBOX_GROUPS,
  FOLDER_DEFINITIONS,
  DEFAULT_FOLDER,
  getFolderDefinition,
  getFoldersForGroup,
} from "./constants/folderTaxonomy";
export type { DemoFolder, MailboxGroup, FolderDefinition } from "./constants/folderTaxonomy";
export { FolderTaxonomySelector } from "./components/FolderTaxonomySelector";
export type { FolderTaxonomySelectorProps } from "./components/FolderTaxonomySelector";

// Campaign snapshot JSON export (issue #273): serializer, filename builder.
export {
  buildCampaignExport,
  serializeCampaignSnapshot,
  buildCampaignExportFilename,
} from "./helpers/campaignExport";
export { CAMPAIGN_EXPORT_SCHEMA_VERSION } from "./types/campaignExport";
export type { CampaignExportMeta, CampaignSnapshotExport } from "./types/campaignExport";

// Calendar Event Editor (issue #16): editor component, types, fixtures, validation.
export { CalendarEventEditor } from "./components/CalendarEventEditor";
export type { CalendarEventEditorProps } from "./components/CalendarEventEditor";
export { prepareAttendees, formatAttendeesDisplay } from "./components/CalendarEventEditor";
export type {
  CalendarEventEditorState,
  CalendarResponseState,
  CalendarResponseStateOption,
} from "./types/calendarEvent";
export {
  CALENDAR_RESPONSE_STATES,
  CALENDAR_RESPONSE_STATE_OPTIONS,
  DEFAULT_RESPONSE_STATE,
  getResponseStateOption,
  calendarEventToEditorState,
  editorStateToCalendarEvent,
} from "./types/calendarEvent";
export { calendarEventFixtures, defaultCalendarEvent } from "./fixtures/calendarEventFixtures";
export { validateCalendarEventEditor } from "./calendarEventValidation";

// Label manager (issue #185): types, helpers, fixtures, and UI.
export type { DemoLabel, LabeledDemoMessage, LabelUsage } from "./labels/types";
export {
  addLabel,
  countLabelUsage,
  createLabel,
  normalizeLabelName,
  removeLabel,
  toLabelId,
  unusedLabels,
} from "./labels/labelNormalization";
export { demoLabels, labeledDemoMessages } from "./labels/labelFixtures";
export { LabelManager } from "./labels/LabelManager";

// Bulk label panel (issue #40): add/remove labels across selected demo messages.
export { BulkLabelPanel, calculateLabelState } from "./components/BulkLabelPanel";
export type { BulkLabelPanelProps } from "./components/BulkLabelPanel";
export {
  applyBulkLabelEdit,
  normalizeLabelsForBulk,
  summarizeBulkLabelEdit,
} from "./bulkLabelPanel";
export type {
  BulkLabelAuditSummary,
  BulkLabelEditResult,
  BulkLabelMessageChange,
  BulkLabelOperation,
} from "./bulkLabelPanel";

// Draft dataset JSON import (issue #272): JSON -> safe drafts mapper with error output.
export { mapImportedDataset, parseDatasetImport } from "./helpers/datasetImport";
export type { DatasetImportIssue, DatasetImportResult } from "./types/datasetImport";

// Validation quick-fix framework (issue #221): one-click fixes for demo-data validation issues.
export {
  applyQuickFix,
  createQuickFixRegistry,
  defaultQuickFixRegistry,
  quickFixKindForIssue,
  toSafeRecipient,
  SAFE_BODY,
  SAFE_RECIPIENT,
  SAFE_SUBJECT,
} from "./helpers/quickFixRegistry";
export type {
  QuickFix,
  QuickFixApplication,
  QuickFixKind,
  QuickFixRegistry,
} from "./types/quickFix";
// Scenario registry and loader (issue #216): load demo scenarios into draft state.
export {
  createScenarioRegistry,
  demoScenarios,
  loadScenarioIntoDraft,
} from "./helpers/scenarioRegistry";
export type { DemoScenario, ScenarioLoadMode, ScenarioRegistry } from "./types/scenario";

// Demo Inbox Preview Components (issue #24): folder-local preview without live integration
export { DemoInboxPreview } from "./components/DemoInboxPreview";
export { DemoInboxList } from "./components/DemoInboxList";
export { DemoMailReader } from "./components/DemoMailReader";

// Demo Inbox Data Fixtures (issue #24): safe demo data for inbox preview
export {
  createDemoInboxData,
  getDemoMessagesByLabel,
  getUnreadDemoMessages,
  getStarredDemoMessages,
  getDemoMessagesWithAttachments,
  getDemoMessagesWithEvents,
} from "./fixtures/demoInboxData";

// Demo Data Validation (issue #24): safety compliance helpers
export {
  validateDemoDataset,
  validateDemoMessage,
  validateDemoSender,
  validateSafeEmailAddress,
  validateTextContent,
  generateComplianceReport,
  assertDemoDataSafety,
} from "./helpers/demoDataValidator";
export type { ValidationIssue, ValidationResult } from "./helpers/demoDataValidator";
