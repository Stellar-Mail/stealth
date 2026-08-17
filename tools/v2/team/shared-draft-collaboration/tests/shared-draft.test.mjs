/**
 * shared-draft.test.mjs — Shared Draft Collaboration
 *
 * Unit tests for core service logic. Runs with:
 *   node --test tools/v2/team/shared-draft-collaboration/tests/shared-draft.test.mjs
 *
 * No React / DOM / TypeScript loader required.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeMetrics, applyFilter, createDraftService } from "../services/draft.service.mjs";

import { DRAFT_FIXTURES, ACTIVE_DRAFTS, INACTIVE_DRAFTS } from "../fixtures/drafts.fixtures.mjs";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

describe("Shared Draft Collaboration — Fixtures", () => {
  it("has 4 fixture drafts", () => {
    assert.strictEqual(DRAFT_FIXTURES.length, 4);
  });

  it("has 2 active and 2 inactive drafts", () => {
    assert.strictEqual(ACTIVE_DRAFTS.length, 2);
    assert.strictEqual(INACTIVE_DRAFTS.length, 2);
  });

  it("every fixture has required fields", () => {
    for (const d of DRAFT_FIXTURES) {
      assert.ok(d.id, "missing id");
      assert.ok(d.title, "missing title");
      assert.ok(typeof d.collaborators === "number", "collaborators must be number");
      assert.ok(typeof d.isActive === "boolean", "isActive must be boolean");
      assert.ok(!isNaN(Date.parse(d.lastModified)), "lastModified must be valid ISO date");
    }
  });
});

// ---------------------------------------------------------------------------
// computeMetrics
// ---------------------------------------------------------------------------

describe("Shared Draft Collaboration — computeMetrics", () => {
  it("returns correct totals for fixture data", () => {
    const m = computeMetrics(DRAFT_FIXTURES);
    assert.strictEqual(m.total, 4);
    assert.strictEqual(m.active, 2);
    assert.strictEqual(m.inactive, 2);
    assert.strictEqual(m.totalCollaborators, 10); // 3+2+4+1
  });

  it("returns zero metrics for empty list", () => {
    const m = computeMetrics([]);
    assert.strictEqual(m.total, 0);
    assert.strictEqual(m.active, 0);
    assert.strictEqual(m.inactive, 0);
    assert.strictEqual(m.totalCollaborators, 0);
  });

  it("counts correctly for a single-entry list", () => {
    const m = computeMetrics([DRAFT_FIXTURES[0]]);
    assert.strictEqual(m.total, 1);
    assert.strictEqual(m.active, 1);
    assert.strictEqual(m.inactive, 0);
    assert.strictEqual(m.totalCollaborators, 3);
  });
});

// ---------------------------------------------------------------------------
// applyFilter
// ---------------------------------------------------------------------------

describe("Shared Draft Collaboration — applyFilter", () => {
  it("returns all entries with empty filter", () => {
    assert.strictEqual(applyFilter(DRAFT_FIXTURES, {}).length, 4);
  });

  it("filters by isActive=true", () => {
    const result = applyFilter(DRAFT_FIXTURES, { isActive: true });
    assert.strictEqual(result.length, 2);
    assert.ok(result.every((d) => d.isActive));
  });

  it("filters by isActive=false", () => {
    const result = applyFilter(DRAFT_FIXTURES, { isActive: false });
    assert.strictEqual(result.length, 2);
    assert.ok(result.every((d) => !d.isActive));
  });

  it("filters by search matching title (case-insensitive)", () => {
    const result = applyFilter(DRAFT_FIXTURES, { search: "q1 team" });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "draft-001");
  });

  it("filters by search matching subject", () => {
    const result = applyFilter(DRAFT_FIXTURES, { search: "incident" });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "draft-004");
  });

  it("returns empty array when search matches nothing", () => {
    const result = applyFilter(DRAFT_FIXTURES, { search: "zzz-no-match" });
    assert.strictEqual(result.length, 0);
  });

  it("combines isActive and search filters", () => {
    // isActive=true AND title contains "security"
    const result = applyFilter(DRAFT_FIXTURES, { isActive: true, search: "security" });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "draft-004");
  });
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

describe("Shared Draft Collaboration — Service", () => {
  it("getDrafts returns all fixture entries by default", async () => {
    const svc = createDraftService();
    const drafts = await svc.getDrafts();
    assert.strictEqual(drafts.length, 4);
  });

  it("getDrafts respects isActive filter", async () => {
    const svc = createDraftService();
    const active = await svc.getDrafts({ isActive: true });
    assert.strictEqual(active.length, 2);
    assert.ok(active.every((d) => d.isActive));
  });

  it("addDraft creates a new inactive draft with auto id", async () => {
    const svc = createDraftService();
    const added = await svc.addDraft({
      title: "New Draft",
      subject: "Test subject",
      collaborators: 2,
    });

    assert.ok(added.id.startsWith("draft-"));
    assert.strictEqual(added.title, "New Draft");
    assert.strictEqual(added.collaborators, 2);
    assert.strictEqual(added.isActive, false);
    assert.ok(!isNaN(Date.parse(added.lastModified)));

    const all = await svc.getDrafts();
    assert.strictEqual(all.length, 5);
  });

  it("addDraft defaults collaborators to 1 when not provided", async () => {
    const svc = createDraftService();
    const added = await svc.addDraft({ title: "Solo Draft" });
    assert.strictEqual(added.collaborators, 1);
  });

  it("updateDraft changes title and updates lastModified", async () => {
    const svc = createDraftService();
    const updated = await svc.updateDraft({ id: "draft-002", title: "Updated Title" });
    assert.strictEqual(updated.title, "Updated Title");
    assert.ok(!isNaN(Date.parse(updated.lastModified)));
  });

  it("updateDraft throws for unknown id", async () => {
    const svc = createDraftService();
    await assert.rejects(() => svc.updateDraft({ id: "draft-999", title: "X" }), /not found/);
  });

  it("removeDraft deletes the entry permanently", async () => {
    const svc = createDraftService();
    await svc.removeDraft("draft-001");
    const all = await svc.getDrafts();
    assert.strictEqual(all.length, 3);
    assert.ok(!all.some((d) => d.id === "draft-001"));
  });

  it("removeDraft throws for unknown id", async () => {
    const svc = createDraftService();
    await assert.rejects(() => svc.removeDraft("draft-999"), /not found/);
  });

  it("setActive marks a draft as active", async () => {
    const svc = createDraftService();
    const updated = await svc.setActive("draft-002");
    assert.strictEqual(updated.isActive, true);

    const active = await svc.getDrafts({ isActive: true });
    assert.ok(active.some((d) => d.id === "draft-002"));
  });

  it("setActive throws for unknown id", async () => {
    const svc = createDraftService();
    await assert.rejects(() => svc.setActive("draft-999"), /not found/);
  });

  it("getMetrics reflects current state after mutations", async () => {
    const svc = createDraftService();
    await svc.removeDraft("draft-001");
    const m = await svc.getMetrics();
    assert.strictEqual(m.total, 3);
    assert.strictEqual(m.active, 1);
  });

  it("service starts with empty list and tracks additions", async () => {
    const svc = createDraftService([]);
    let drafts = await svc.getDrafts();
    assert.strictEqual(drafts.length, 0);

    await svc.addDraft({ title: "First", collaborators: 1 });
    drafts = await svc.getDrafts();
    assert.strictEqual(drafts.length, 1);

    const m = await svc.getMetrics();
    assert.strictEqual(m.total, 1);
    assert.strictEqual(m.active, 0);
  });
});

// ---------------------------------------------------------------------------
// Security & Performance Guards
// ---------------------------------------------------------------------------

describe("Shared Draft Collaboration — Security & Performance Guards", () => {
  it("sanitizeText removes HTML/script tags (XSS check)", () => {
    import("../guards/draft-guards.mjs").then((guards) => {
      const dirty = "Draft Title <script>alert('xss')</script> check";
      const clean = guards.sanitizeText(dirty);
      assert.strictEqual(clean, "Draft Title alert('xss') check");
    });
  });

  it("sanitizeText blocks CRLF header injection and null bytes", () => {
    import("../guards/draft-guards.mjs").then((guards) => {
      const dirty = "SubjectLine\r\nBcc: victim@example.test\0test";
      const clean = guards.sanitizeText(dirty);
      assert.ok(!clean.includes("\r"));
      assert.ok(!clean.includes("\n"));
      assert.ok(!clean.includes("\0"));
    });
  });

  it("validateDraftId rejects path traversal and special characters", async () => {
    const guards = await import("../guards/draft-guards.mjs");
    assert.throws(() => guards.validateDraftId("../../../secret"), /contains illegal characters/);
    assert.throws(() => guards.validateDraftId("draft 001"), /contains illegal characters/);
    assert.throws(
      () => guards.validateDraftId("draft-id-with-symbols$"),
      /contains illegal characters/,
    );
    assert.strictEqual(guards.validateDraftId("draft-099_ok"), "draft-099_ok");
  });

  it("validateDraftTitle rejects empty, null or oversized titles", async () => {
    const guards = await import("../guards/draft-guards.mjs");
    assert.throws(() => guards.validateDraftTitle(""), /non-empty string/);
    assert.throws(() => guards.validateDraftTitle("   "), /non-empty string/);
    assert.throws(() => guards.validateDraftTitle(123), /non-empty string/);

    const longTitle = "a".repeat(121);
    assert.throws(() => guards.validateDraftTitle(longTitle), /exceeds maximum length/);
  });

  it("validateCollaboratorCount rejects out-of-bound values", async () => {
    const guards = await import("../guards/draft-guards.mjs");
    assert.throws(() => guards.validateCollaboratorCount(0), /must be between/);
    assert.throws(() => guards.validateCollaboratorCount(51), /must be between/);
    assert.throws(() => guards.validateCollaboratorCount(1.5), /must be an integer/);
    assert.strictEqual(guards.validateCollaboratorCount(12), 12);
  });

  it("validateSearchQuery throws when query is oversized", async () => {
    const guards = await import("../guards/draft-guards.mjs");
    const longQuery = "q".repeat(101);
    assert.throws(() => guards.validateSearchQuery(longQuery), /exceeds maximum length/);
  });

  it("guardDraftsCount throws when collection is full", async () => {
    const guards = await import("../guards/draft-guards.mjs");
    const fullList = Array(1000).fill({});
    assert.throws(() => guards.guardDraftsCount(fullList), /safe limit/);
  });

  it("service validates inputs on addDraft", async () => {
    const svc = createDraftService();
    await assert.rejects(() => svc.addDraft({ title: "", collaborators: 1 }), /title must be/);
    await assert.rejects(
      () => svc.addDraft({ title: "Draft", collaborators: 60 }),
      /collaborators count must be/,
    );
  });

  it("service validates inputs on updateDraft", async () => {
    const svc = createDraftService();
    await assert.rejects(
      () => svc.updateDraft({ id: "draft-001", title: "a".repeat(130) }),
      /title exceeds/,
    );
    await assert.rejects(
      () => svc.updateDraft({ id: "draft-001", collaborators: -1 }),
      /collaborators count must be/,
    );
  });
});
