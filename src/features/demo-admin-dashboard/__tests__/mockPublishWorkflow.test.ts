import { describe, expect, it } from "vitest";
import {
  canRetryMockPublish,
  canRollbackMockPublish,
  canStartMockPublish,
  getMockPublishSummary,
  initialMockPublishState,
  mockPublishReducer,
} from "../mockPublishWorkflow";

describe("mockPublishWorkflow", () => {
  it("previews queued demo drafts", () => {
    const preview = mockPublishReducer(initialMockPublishState, {
      type: "preview",
      payload: { draftCount: 2 },
    });

    expect(preview.status).toBe("preview");
    expect(preview.draftCount).toBe(2);
    expect(canStartMockPublish(preview)).toBe(true);
    expect(getMockPublishSummary(preview)).toBe("2 demo drafts ready for preview.");
  });

  it("rejects publishing without queued draft data", () => {
    const failed = mockPublishReducer(initialMockPublishState, { type: "start" });

    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("Add at least one demo draft before publishing.");
    expect(canRetryMockPublish(failed)).toBe(true);
  });

  it("starts and completes a local mock publish", () => {
    const preview = mockPublishReducer(initialMockPublishState, {
      type: "preview",
      payload: { draftCount: 1 },
    });
    const publishing = mockPublishReducer(preview, {
      type: "start",
      payload: { now: "2026-06-20T09:00:00Z" },
    });
    const published = mockPublishReducer(publishing, {
      type: "succeed",
      payload: { now: "2026-06-20T09:00:05Z" },
    });

    expect(publishing.status).toBe("publishing");
    expect(publishing.attempt).toBe(1);
    expect(publishing.steps.map((step) => step.complete)).toEqual([true, true, false]);
    expect(published.status).toBe("published");
    expect(published.rollbackAvailable).toBe(true);
    expect(published.steps.every((step) => step.complete)).toBe(true);
    expect(getMockPublishSummary(published)).toBe("Mock publish completed for 1 demo draft.");
  });

  it("supports failure, retry, and rollback simulation", () => {
    const preview = mockPublishReducer(initialMockPublishState, {
      type: "preview",
      payload: { draftCount: 3 },
    });
    const publishing = mockPublishReducer(preview, { type: "start" });
    const failed = mockPublishReducer(publishing, {
      type: "fail",
      payload: { message: "Fixture validation failed." },
    });
    const retrying = mockPublishReducer(failed, { type: "retry" });
    const published = mockPublishReducer(retrying, {
      type: "succeed",
      payload: { now: "2026-06-20T09:01:00Z" },
    });
    const rolledBack = mockPublishReducer(published, { type: "rollback" });

    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("Fixture validation failed.");
    expect(retrying.status).toBe("publishing");
    expect(retrying.attempt).toBe(2);
    expect(canRollbackMockPublish(published)).toBe(true);
    expect(rolledBack.status).toBe("rolled-back");
    expect(rolledBack.rollbackAvailable).toBe(false);
    expect(rolledBack.steps.every((step) => !step.complete)).toBe(true);
  });

  it("resets the workflow back to idle", () => {
    const preview = mockPublishReducer(initialMockPublishState, {
      type: "preview",
      payload: { draftCount: 1 },
    });

    expect(mockPublishReducer(preview, { type: "reset" })).toEqual(initialMockPublishState);
  });
});
