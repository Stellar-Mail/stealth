import type { MailFolder } from "./data";

export type BottomNavItemId = "compose" | "search" | "inbox" | "calendar" | "proofs" | "settings";

export interface BottomNavItemConfig {
  id: BottomNavItemId;
  label: string;
  /**
   * The folder this tab selects, when the tab represents a folder destination.
   * Action-only tabs (compose, search, calendar, settings) leave this undefined
   * and never render as the active tab.
   */
  folder?: MailFolder;
}

/**
 * Static descriptor for the mobile bottom navigation, in left-to-right display
 * order. Icons and click handlers are bound in the component; this module owns
 * only the stable, presentation-free contract so it can be unit tested.
 */
export const BOTTOM_NAV_ITEMS: readonly BottomNavItemConfig[] = [
  { id: "compose", label: "Compose" },
  { id: "search", label: "Search" },
  { id: "inbox", label: "Inbox", folder: "inbox" },
  { id: "calendar", label: "Calendar" },
  { id: "proofs", label: "Proofs", folder: "pending" },
  { id: "settings", label: "Settings" },
];

/**
 * A bottom-nav tab is highlighted only when it maps to a folder and that folder
 * is the one currently being viewed. Action-only tabs are never active.
 */
export function isBottomNavItemActive(
  item: BottomNavItemConfig,
  activeFolder: MailFolder,
): boolean {
  return item.folder !== undefined && item.folder === activeFolder;
}
