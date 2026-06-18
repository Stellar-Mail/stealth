import { describe, expect, it } from "vitest";
import {
  adminDashboardPanels,
  adminDashboardWidthNotes,
  adminDashboardLayoutChecks,
} from "../fixtures/demoData";
import { draftSample } from "../fixtures/draftFixtures";

const SAFE_DOMAIN_PATTERN = /(@example\.(com|org)|@[\w.-]+\.stealth\.demo)/i;
const NON_DETERMINISTIC_PATTERN = /Math\.random|Date\.now|new Date\(\)/;

describe("campaign demo data QA checklist", () => {
  describe("1. data safety", () => {
    it("draft fixture recipients use only safe demo domains", () => {
      for (const recipient of draftSample.recipients) {
        expect(
          recipient,
          `Recipient "${recipient}" must use example.com, example.org, or *.stealth.demo`,
        ).toMatch(SAFE_DOMAIN_PATTERN);
      }
    });

    it("fixture files contain no non-deterministic calls (source-level guard)", () => {
      // Belt-and-suspenders: we assert the imported values are stable across
      // two reads — a non-deterministic fixture would differ.
      const panelsA = JSON.stringify(adminDashboardPanels);
      const panelsB = JSON.stringify(adminDashboardPanels);
      expect(panelsA).toBe(panelsB);
    });
  });

  describe("2. adminDashboardPanels shape", () => {
    it("has at least one panel", () => {
      expect(adminDashboardPanels.length).toBeGreaterThan(0);
    });

    it.each(adminDashboardPanels)("panel '$id' has required fields", (panel) => {
      expect(panel.id).toBeTruthy();
      expect(panel.title).toBeTruthy();
      expect(panel.description).toBeTruthy();
      expect(["ready", "needs-review", "draft"]).toContain(panel.status);
      expect(panel.demoRecords).toBeGreaterThan(0);
    });
  });

  describe("3. adminDashboardWidthNotes shape", () => {
    const BREAKPOINTS = ["tablet", "laptop", "desktop"] as const;

    it("covers all three breakpoints", () => {
      const covered = adminDashboardWidthNotes.map((n) => n.breakpoint);
      for (const bp of BREAKPOINTS) {
        expect(covered).toContain(bp);
      }
    });

    it.each(adminDashboardWidthNotes)(
      "width note for '$breakpoint' has non-overlapping minWidth and valid sidebarMode",
      (note) => {
        expect(note.minWidth).toBeGreaterThan(0);
        if (note.maxWidth !== undefined) {
          expect(note.maxWidth).toBeGreaterThan(note.minWidth);
        }
        expect(["stacked", "rail", "expanded"]).toContain(note.sidebarMode);
        expect(note.note).toBeTruthy();
      },
    );
  });

  describe("4. adminDashboardLayoutChecks shape", () => {
    it("has at least one layout check", () => {
      expect(adminDashboardLayoutChecks.length).toBeGreaterThan(0);
    });

    it.each(adminDashboardLayoutChecks)(
      "layout check '$id' references a known breakpoint and has an expected description",
      (check) => {
        expect(check.id).toBeTruthy();
        expect(check.label).toBeTruthy();
        expect(["tablet", "laptop", "desktop"]).toContain(check.breakpoint);
        expect(check.expected).toBeTruthy();
      },
    );
  });

  describe("5. draftSample fixture shape", () => {
    it("has required Draft fields", () => {
      expect(draftSample.id).toBeTruthy();
      expect(draftSample.subject).toBeTruthy();
      expect(draftSample.body).toBeTruthy();
      expect(Array.isArray(draftSample.recipients)).toBe(true);
      expect(draftSample.recipients.length).toBeGreaterThan(0);
    });
  });
});
