import { describe, expect, it } from "vitest";

import {
  LARGE_BATCH_THRESHOLD,
  MAX_SUBJECT_LENGTH,
  buildCampaignPublishChecklist,
  isCampaignReadyToPublish,
  summarizeCampaignPublishChecklist,
  type CampaignPublishChecklistInput,
} from "../campaignPublishChecklist";

function baseCampaign(): CampaignPublishChecklistInput {
  return {
    name: "Spring Launch",
    tags: ["launch", "demo"],
    drafts: [
      {
        subject: "Welcome aboard",
        body: "Thanks for joining the Stellar Mail demo inbox.",
        recipients: ["alex@example.com"],
      },
      {
        subject: "Getting started",
        body: "Here is how to explore the demo dataset.",
        recipients: ["jordan@example.com", "sam@example.com"],
      },
    ],
  };
}

function itemById(report: ReturnType<typeof buildCampaignPublishChecklist>, id: string) {
  return report.items.find((item) => item.id === id);
}

describe("buildCampaignPublishChecklist", () => {
  it("marks a complete campaign as ready with no blockers or warnings", () => {
    const report = buildCampaignPublishChecklist(baseCampaign());

    expect(report.ready).toBe(true);
    expect(report.blockers).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
    expect(report.summary).toBe("Campaign is ready for mock publish.");
  });

  it("flags a missing campaign name as a blocker", () => {
    const report = buildCampaignPublishChecklist({
      ...baseCampaign(),
      name: "  ",
    });

    expect(report.ready).toBe(false);
    expect(itemById(report, "campaign-name")?.status).toBe("fail");
    expect(report.blockers.some((item) => item.id === "campaign-name")).toBe(true);
  });

  it("requires at least one draft", () => {
    const report = buildCampaignPublishChecklist({
      ...baseCampaign(),
      drafts: [],
    });

    expect(report.ready).toBe(false);
    expect(itemById(report, "has-drafts")?.status).toBe("fail");
  });

  it("flags drafts missing a subject, body, or recipients", () => {
    const report = buildCampaignPublishChecklist({
      ...baseCampaign(),
      drafts: [{ subject: "  ", body: "  ", recipients: [] }],
    });

    expect(itemById(report, "draft-subjects")?.status).toBe("fail");
    expect(itemById(report, "draft-bodies")?.status).toBe("fail");
    expect(itemById(report, "draft-recipients")?.status).toBe("fail");
    expect(report.ready).toBe(false);
  });

  it("detects a Stellar secret key in a draft body", () => {
    const secret = "S" + "A".repeat(55);
    const report = buildCampaignPublishChecklist({
      ...baseCampaign(),
      drafts: [
        {
          subject: "Funds",
          body: "Import this key " + secret + " into the wallet.",
          recipients: ["alex@example.com"],
        },
      ],
    });

    expect(itemById(report, "no-secret-keys")?.status).toBe("fail");
    expect(report.ready).toBe(false);
  });

  it("warns when the campaign has no tags", () => {
    const report = buildCampaignPublishChecklist({ ...baseCampaign(), tags: [] });

    expect(report.ready).toBe(true);
    expect(itemById(report, "has-tags")?.status).toBe("fail");
    expect(report.warnings.some((item) => item.id === "has-tags")).toBe(true);
  });

  it("warns about duplicate recipients without blocking publish", () => {
    const report = buildCampaignPublishChecklist({
      ...baseCampaign(),
      drafts: [
        {
          subject: "Reminder",
          body: "Please join the demo walkthrough.",
          recipients: ["alex@example.com", "ALEX@example.com"],
        },
      ],
    });

    expect(report.ready).toBe(true);
    expect(itemById(report, "unique-recipients")?.status).toBe("fail");
  });

  it("warns when the draft batch exceeds the preview limit", () => {
    const drafts = Array.from({ length: LARGE_BATCH_THRESHOLD + 1 }, (_, index) => ({
      subject: "Update " + index,
      body: "Demo body content.",
      recipients: ["user" + index + "@example.com"],
    }));
    const report = buildCampaignPublishChecklist({ ...baseCampaign(), drafts });

    expect(report.ready).toBe(true);
    expect(itemById(report, "batch-size")?.status).toBe("fail");
  });

  it("warns when a subject exceeds the recommended length", () => {
    const report = buildCampaignPublishChecklist({
      ...baseCampaign(),
      drafts: [
        {
          subject: "x".repeat(MAX_SUBJECT_LENGTH + 1),
          body: "Demo body content.",
          recipients: ["alex@example.com"],
        },
      ],
    });

    expect(report.ready).toBe(true);
    expect(itemById(report, "subject-length")?.status).toBe("fail");
  });

  it("is deterministic for identical input", () => {
    const first = buildCampaignPublishChecklist(baseCampaign());
    const second = buildCampaignPublishChecklist(baseCampaign());

    expect(first).toEqual(second);
  });
});

describe("isCampaignReadyToPublish", () => {
  it("returns true for a complete campaign", () => {
    expect(isCampaignReadyToPublish(baseCampaign())).toBe(true);
  });

  it("returns false when a blocker is present", () => {
    expect(isCampaignReadyToPublish({ ...baseCampaign(), name: "" })).toBe(false);
  });
});

describe("summarizeCampaignPublishChecklist", () => {
  it("summarizes a ready campaign that still has warnings", () => {
    const report = buildCampaignPublishChecklist({ ...baseCampaign(), tags: [] });

    expect(summarizeCampaignPublishChecklist(report)).toBe(
      "Campaign is ready for mock publish with 1 warning.",
    );
  });

  it("summarizes blockers when the campaign is not ready", () => {
    const report = buildCampaignPublishChecklist({ ...baseCampaign(), name: "" });

    expect(summarizeCampaignPublishChecklist(report)).toBe(report.summary);
    expect(report.summary.startsWith("Campaign is not ready")).toBe(true);
  });
});
