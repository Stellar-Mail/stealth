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

export { AdminSearchBar } from "./AdminSearchBar";
export type { AdminSearchBarProps } from "./AdminSearchBar";
export { filterRows, normalize, resultCountLabel, searchAdminRecords } from "./searchRows";
export { demoAdminRecords, adminSearchFields } from "./fixtures";
export type { AdminDemoRecord, AdminRecordStatus } from "./types";
