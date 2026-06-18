export { DemoAdminDashboard } from "./DemoAdminDashboard";
export { DemoAdminDashboard as DemoAdminLayoutDashboard } from "./components/DemoAdminDashboard";
export {
  ADMIN_DASHBOARD_MIN_SUPPORTED_WIDTH,
  getAdminDashboardBreakpoint,
  getAdminDashboardWidthNote,
  isAdminDashboardWidthSupported,
} from "./layout";

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
