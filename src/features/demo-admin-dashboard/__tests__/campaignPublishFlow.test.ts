import { describe, expect, it } from "vitest";

import {
  collectPublishBlockers,
  planCampaignPublish,
  rollbackCampaignPublish,
  runMockCampaignPublish,
  summarizePublishResult,
} from "../campaignPublishFlow";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import type { Draft } from "../types/draft";

function draft(id: string): Draft {
  return {
    id,
    subject: `Subject ${id}`,
    body: `Body ${id}`,
    recipients: [`${id}@example.com`],
  };
}

function snapshot(overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot {
  return {
    id: "campaign-1",
    name: "Launch announcement",
    description: "Tell customers about the launch.",
    targetAudience: "All subscribers",
    tags: ["launch"],
    timestamp: "2026-01-01T09:00:00.000Z",
    status: "draft",
    drafts: [draft("d1"), draft("d2")],
    ...overrides,
  };
}

describe("campaign mock publish flow", () => {
  it("publishes a valid campaign through every stage", () => {
    const result = runMockCampaignPublish(snapshot());

    expect(result.status).toBe("published");
    expect(result.overallProgress).toBe(100);
    expect(result.publishedDraftCount).toBe(2);
    expect(result.publishedAt).toBe("2026-01-01T09:00:00.000Z");
    expect(result.stages.map((stage) => stage.status)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
    ]);
    expect(result.canRollback).toBe(true);
  });

  it("is deterministic for the same input", () => {
    expect(runMockCampaignPublish(snapshot())).toEqual(runMockCampaignPublish(snapshot()));
  });

  it("blocks publishing when there are no drafts", () => {
    const result = runMockCampaignPublish(snapshot({ drafts: [] }));

    expect(result.status).toBe("blocked");
    expect(result.overallProgress).toBe(0);
    expect(result.canRollback).toBe(false);
    expect(result.blockers).toContain("Campaign has no drafts to publish.");
  });

  it("blocks archived campaigns", () => {
    expect(collectPublishBlockers(snapshot({ status: "archived" }))).toContain(
      "Archived campaigns cannot be published.",
    );
  });

  it("reports in-progress stages when stopped early", () => {
    const result = runMockCampaignPublish(snapshot(), { stopAfter: "stage-drafts" });

    expect(result.status).toBe("in-progress");
    expect(result.stages[0].status).toBe("complete");
    expect(result.stages[1].status).toBe("complete");
    expect(result.stages[2].status).toBe("running");
    expect(result.stages[3].status).toBe("pending");
    expect(result.canRollback).toBe(true);
  });

  it("rolls back only the completed stages in reverse order", () => {
    const result = runMockCampaignPublish(snapshot(), { stopAfter: "stage-drafts" });
    const plan = rollbackCampaignPublish(result);

    expect(plan.steps.map((step) => step.id)).toEqual(["stage-drafts", "validate"]);
    expect(plan.restoresDraftCount).toBe(result.publishedDraftCount);
  });

  it("summarizes publish results", () => {
    expect(summarizePublishResult(runMockCampaignPublish(snapshot()))).toContain(
      "Published 2 drafts",
    );
  });

  it("plans the full set of stages", () => {
    expect(planCampaignPublish().map((stage) => stage.id)).toEqual([
      "validate",
      "stage-drafts",
      "publish",
      "finalize",
    ]);
  });
});
