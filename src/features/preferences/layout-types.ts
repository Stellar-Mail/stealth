export type LayoutPreferences = {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  listWidth: number;
  readerWidth: number;
  compactMode: boolean;
  rightPanelCollapsed: boolean;
};

export const defaultLayoutPreferences: LayoutPreferences = {
  sidebarWidth: 15,
  sidebarCollapsed: false,
  listWidth: 30,
  readerWidth: 35,
  compactMode: false,
  rightPanelCollapsed: false,
};
