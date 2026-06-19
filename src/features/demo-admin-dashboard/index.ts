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

// Admin empty states (issue #201): reusable component, preset copy, CTA slot.
export { AdminEmptyState } from "./components/AdminEmptyState";
export type { AdminEmptyStateProps } from "./components/AdminEmptyState";
export {
  ADMIN_EMPTY_STATE_PRESETS,
  ADMIN_EMPTY_STATE_KINDS,
  getAdminEmptyStatePreset,
} from "./constants/adminEmptyStates";
export type { AdminEmptyStateCopy, AdminEmptyStateKind } from "./constants/adminEmptyStates";
