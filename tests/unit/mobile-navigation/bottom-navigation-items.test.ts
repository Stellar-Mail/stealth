import { describe, expect, it } from "vitest";
import {
  BOTTOM_NAV_ITEMS,
  isBottomNavItemActive,
  type BottomNavItemConfig,
} from "../../../src/components/mail/bottom-navigation-items";
import type { MailFolder } from "../../../src/components/mail/data";

const itemsById = Object.fromEntries(BOTTOM_NAV_ITEMS.map((item) => [item.id, item])) as Record<
  string,
  BottomNavItemConfig
>;

describe("mobile-navigation/BOTTOM_NAV_ITEMS", () => {
  it("exposes the six tabs in display order", () => {
    expect(BOTTOM_NAV_ITEMS.map((item) => item.id)).toEqual([
      "compose",
      "search",
      "inbox",
      "calendar",
      "proofs",
      "settings",
    ]);
  });

  it("maps only the folder tabs to a destination folder", () => {
    expect(itemsById.inbox.folder).toBe("inbox");
    expect(itemsById.proofs.folder).toBe("pending");
    // Action-only tabs are not folder destinations.
    for (const id of ["compose", "search", "calendar", "settings"]) {
      expect(itemsById[id].folder).toBeUndefined();
    }
  });
});

describe("mobile-navigation/isBottomNavItemActive", () => {
  it("highlights a folder tab when its folder is the current folder (success path)", () => {
    expect(isBottomNavItemActive(itemsById.inbox, "inbox")).toBe(true);
    expect(isBottomNavItemActive(itemsById.proofs, "pending")).toBe(true);
  });

  it("does not highlight a folder tab for a different folder (edge case)", () => {
    expect(isBottomNavItemActive(itemsById.inbox, "pending")).toBe(false);
    expect(isBottomNavItemActive(itemsById.proofs, "inbox")).toBe(false);
    expect(isBottomNavItemActive(itemsById.inbox, "sent")).toBe(false);
  });

  it("never highlights action-only tabs regardless of folder (failure path)", () => {
    const everyFolder: MailFolder[] = [
      "all",
      "inbox",
      "priority",
      "snoozed",
      "verified",
      "pending",
      "requests",
      "encrypted",
      "receipts",
      "starred",
      "sent",
      "outbox",
      "drafts",
      "scheduled",
      "archive",
      "spam",
      "trash",
    ];
    for (const id of ["compose", "search", "calendar", "settings"]) {
      for (const folder of everyFolder) {
        expect(isBottomNavItemActive(itemsById[id], folder)).toBe(false);
      }
    }
  });
});
