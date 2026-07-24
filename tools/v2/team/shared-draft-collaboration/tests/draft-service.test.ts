import { describe, it, expect } from "vitest";
import { computeMetrics, applyFilter, createDraftService } from "../services/draft.service.mjs";
import { DRAFT_FIXTURES } from "../fixtures/drafts.fixtures.mjs";

describe("SharedDraftService", () => {
  function createService(drafts?: unknown[]) {
    return createDraftService(drafts, { delayMs: 0 });
  }

  describe("computeMetrics", () => {
    it("returns correct totals for fixture data", () => {
      const m = computeMetrics(DRAFT_FIXTURES);
      expect(m.total).toBe(4);
      expect(m.active).toBe(2);
      expect(m.inactive).toBe(2);
      expect(m.totalCollaborators).toBe(10);
    });

    it("returns zero metrics for empty list", () => {
      const m = computeMetrics([]);
      expect(m.total).toBe(0);
      expect(m.active).toBe(0);
      expect(m.inactive).toBe(0);
      expect(m.totalCollaborators).toBe(0);
    });
  });

  describe("applyFilter", () => {
    it("returns all entries with empty filter", () => {
      expect(applyFilter(DRAFT_FIXTURES, {}).length).toBe(4);
    });

    it("filters by isActive=true", () => {
      const result = applyFilter(DRAFT_FIXTURES, { isActive: true });
      expect(result).toHaveLength(2);
      expect(result.every((d: { isActive: boolean }) => d.isActive)).toBe(true);
    });

    it("filters by search matching title (case-insensitive)", () => {
      const result = applyFilter(DRAFT_FIXTURES, { search: "q1 team" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("draft-001");
    });
  });

  describe("getDrafts", () => {
    it("returns all fixture entries by default", async () => {
      const svc = createService();
      const drafts = await svc.getDrafts();
      expect(drafts).toHaveLength(4);
    });

    it("respects isActive filter", async () => {
      const svc = createService();
      const active = await svc.getDrafts({ isActive: true });
      expect(active).toHaveLength(2);
      expect(active.every((d: { isActive: boolean }) => d.isActive)).toBe(true);
    });
  });

  describe("addDraft", () => {
    it("creates a new draft with auto id", async () => {
      const svc = createService();
      const added = await svc.addDraft({ title: "New Draft", subject: "Test", collaborators: 2 });

      expect(added.id).toMatch(/^draft-/);
      expect(added.title).toBe("New Draft");
      expect(added.collaborators).toBe(2);
      expect(added.isActive).toBe(false);

      const all = await svc.getDrafts();
      expect(all).toHaveLength(5);
    });

    it("defaults collaborators to 1 when not provided", async () => {
      const svc = createService();
      const added = await svc.addDraft({ title: "Solo Draft" });
      expect(added.collaborators).toBe(1);
    });

    it("throws for empty title", async () => {
      const svc = createService();
      await expect(svc.addDraft({ title: "" })).rejects.toThrow("title must be a non-empty string");
    });
  });

  describe("updateDraft", () => {
    it("changes title and updates lastModified", async () => {
      const svc = createService();
      const updated = await svc.updateDraft({ id: "draft-002", title: "Updated Title" });
      expect(updated.title).toBe("Updated Title");
    });

    it("throws for unknown id", async () => {
      const svc = createService();
      await expect(svc.updateDraft({ id: "draft-999", title: "X" })).rejects.toThrow("not found");
    });
  });

  describe("removeDraft", () => {
    it("deletes the entry permanently", async () => {
      const svc = createService();
      await svc.removeDraft("draft-001");
      const all = await svc.getDrafts();
      expect(all).toHaveLength(3);
      expect(all.some((d: { id: string }) => d.id === "draft-001")).toBe(false);
    });

    it("throws for unknown id", async () => {
      const svc = createService();
      await expect(svc.removeDraft("draft-999")).rejects.toThrow("not found");
    });
  });

  describe("setActive", () => {
    it("marks a draft as active", async () => {
      const svc = createService();
      const updated = await svc.setActive("draft-002");
      expect(updated.isActive).toBe(true);
    });

    it("throws for unknown id", async () => {
      const svc = createService();
      await expect(svc.setActive("draft-999")).rejects.toThrow("not found");
    });
  });

  describe("getMetrics", () => {
    it("reflects current state after mutations", async () => {
      const svc = createService();
      await svc.removeDraft("draft-001");
      const m = await svc.getMetrics();
      expect(m.total).toBe(3);
      expect(m.active).toBe(1);
    });
  });

  describe("loading states", () => {
    it("all operations return Promises", () => {
      const svc = createService();
      expect(svc.getDrafts()).toBeInstanceOf(Promise);
      expect(svc.addDraft({ title: "X" })).toBeInstanceOf(Promise);
      expect(svc.getMetrics()).toBeInstanceOf(Promise);
    });
  });

  describe("error states", () => {
    it("DraftValidationError has name and field", async () => {
      const svc = createService();
      try {
        await svc.addDraft({ title: "" });
        expect.unreachable("Expected error");
      } catch (e) {
        const err = e as Error & { field?: string };
        expect(err.name).toBe("DraftValidationError");
        expect(err.field).toBe("title");
      }
    });

    it("throws descriptive error for not-found", async () => {
      const svc = createService();
      try {
        await svc.updateDraft({ id: "draft-999", title: "X" });
        expect.unreachable("Expected error");
      } catch (e) {
        const err = e as Error;
        expect(err.message).toContain("draft-999");
        expect(err.message).toContain("not found");
      }
    });
  });
});
