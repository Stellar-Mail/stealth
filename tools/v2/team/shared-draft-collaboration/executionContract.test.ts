/**
 * executionContract.test.ts — Shared Draft Collaboration (non-UI execution
 * contract, #1346).
 *
 * Verifies the typed, non-throwing result contract over the existing draft
 * service: success paths and the failure paths (validation, not-found). No UI
 * is exercised.
 */

import { describe, expect, it } from "vitest";

import {
  createDraftExecutionContract,
  DraftErrorCode,
  type DraftExecutionContract,
} from "./executionContract";
import {
  VALID_CREATE,
  INVALID_CREATE_EMPTY_TITLE,
  INVALID_CREATE_BAD_COLLAB,
  UNKNOWN_DRAFT_ID,
} from "./executionContract.fixtures";
import { DRAFT_FIXTURES } from "./fixtures/drafts.fixtures.mjs";

describe("shared-draft execution contract (#1346)", () => {
  it("exposes a non-UI service entry point", () => {
    const c = createDraftExecutionContract();
    const ops: (keyof DraftExecutionContract)[] = [
      "getDrafts",
      "addDraft",
      "updateDraft",
      "removeDraft",
      "setActive",
      "getMetrics",
    ];
    for (const op of ops) {
      expect(typeof c[op]).toBe("function");
    }
  });

  it("lists seeded drafts on success", async () => {
    const c = createDraftExecutionContract();
    const res = await c.getDrafts();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.length).toBe(DRAFT_FIXTURES.length);
  });

  it("filters by active flag", async () => {
    const c = createDraftExecutionContract();
    const res = await c.getDrafts({ isActive: true });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.every((d) => d.isActive)).toBe(true);
  });

  it("adds a draft on success", async () => {
    const c = createDraftExecutionContract();
    const res = await c.addDraft(VALID_CREATE);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.title).toBe("Launch Announcement");
      expect(res.value.collaborators).toBe(2);
    }
  });

  it("returns a typed validation error for empty title (no throw)", async () => {
    const c = createDraftExecutionContract();
    const res = await c.addDraft(INVALID_CREATE_EMPTY_TITLE);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const failed = res as Extract<typeof res, { ok: false }>;
      expect(failed.error.code).toBe(DraftErrorCode.Validation);
      expect(failed.error.field).toBe("title");
    }
  });

  it("returns a typed validation error for out-of-range collaborators", async () => {
    const c = createDraftExecutionContract();
    const res = await c.addDraft(INVALID_CREATE_BAD_COLLAB);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const failed = res as Extract<typeof res, { ok: false }>;
      expect(failed.error.code).toBe(DraftErrorCode.Validation);
    }
  });

  it("returns a typed not-found error when removing unknown id", async () => {
    const c = createDraftExecutionContract();
    const res = await c.removeDraft(UNKNOWN_DRAFT_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const failed = res as Extract<typeof res, { ok: false }>;
      expect(failed.error.code).toBe(DraftErrorCode.NotFound);
    }
  });

  it("returns a typed not-found error when updating unknown id", async () => {
    const c = createDraftExecutionContract();
    const res = await c.updateDraft({ id: UNKNOWN_DRAFT_ID, title: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const failed = res as Extract<typeof res, { ok: false }>;
      expect(failed.error.code).toBe(DraftErrorCode.NotFound);
    }
  });

  it("computes metrics on success", async () => {
    const c = createDraftExecutionContract();
    const res = await c.getMetrics();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.total).toBe(DRAFT_FIXTURES.length);
      expect(res.value.active + res.value.inactive).toBe(res.value.total);
    }
  });
});
