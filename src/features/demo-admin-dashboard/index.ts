export { DemoAdminDashboard } from "./DemoAdminDashboard";
export { DemoAdminDashboard as DemoAdminLayoutDashboard } from "./components/DemoAdminDashboard";/
export { AdminPage } from './components/AdminPage';
export { AdminPanel } from './components/AdminPanel';
export { AdminToolbar } from './components/AdminToolbar';
export { AdminSection } from './components/AdminSection';

export * from './types';
export * from './fixtures';
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

export {
  TemplatePicker,
  messageTemplates,
  searchTemplates,
  groupByCategory,
  templateToDraft,
  draftIdForTemplate,
  isTemplateInserted,
  insertTemplate,
  removeDraft,
  TEMPLATE_CATEGORY_LABEL,
  type InsertResult,
  type MessageTemplate,
  type TemplateCategory,
} from "./templates";
