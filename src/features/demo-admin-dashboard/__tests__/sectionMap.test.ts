import { describe, expect, it } from "vitest";
import type { DashboardSection } from "../types";
import { NAV_ITEMS, SECTION_ICON } from "../DemoAdminDashboard";

/**
 * Canonical list of all dashboard sections.
 * This is the single source of truth the tests assert against.
 * If a section is added or removed, update this list and the
 * DashboardSection union type in types.ts.
 */
const ALL_SECTIONS: DashboardSection[] = [
  "overview",
  "accounts",
  "mail",
  "attachments",
  "events",
  "templates",
  "campaigns",
  "audit",
  "analytics",
];

describe("demo admin dashboard section map", () => {
  describe("NAV_ITEMS (imported from DemoAdminDashboard)", () => {
    it("exports exactly 9 nav items", () => {
      expect(NAV_ITEMS).toHaveLength(9);
    });

    it("covers every DashboardSection value", () => {
      const navIds = NAV_ITEMS.map((item) => item.id);
      expect(navIds).toEqual(ALL_SECTIONS);
    });

    it("each nav item has a non-empty label", () => {
      for (const item of NAV_ITEMS) {
        expect(item.label.length).toBeGreaterThan(0);
      }
    });

    it("no two nav items share the same id", () => {
      const ids = NAV_ITEMS.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("SECTION_ICON (imported from DemoAdminDashboard)", () => {
    it("has an icon entry for every DashboardSection value", () => {
      for (const section of ALL_SECTIONS) {
        expect(SECTION_ICON).toHaveProperty(section);
      }
    });

    it("has no extra icon entries beyond the canonical sections", () => {
      expect(Object.keys(SECTION_ICON).sort()).toEqual([...ALL_SECTIONS].sort());
    });
  });

  describe("DashboardSection type coverage", () => {
    it("all canonical values are non-empty strings", () => {
      for (const val of ALL_SECTIONS) {
        expect(val.length).toBeGreaterThan(0);
      }
    });

    it("NAV_ITEMS ids match the canonical section list", () => {
      const navIds = new Set(NAV_ITEMS.map((item) => item.id));
      for (const section of ALL_SECTIONS) {
        expect(navIds.has(section)).toBe(true);
      }
    });
  });
});
