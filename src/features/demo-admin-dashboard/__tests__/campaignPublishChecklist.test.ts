import { describe, expect, it } from "vitest";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import {
  buildCampaignPublishChecklist,
  getCampaignPublishBlockers,
  getCampaignPublishWarnings,
  summarizeCampaignPublishChecklist,
} from "../campaignPublishChecklist";

const readyCampaign: CampaignSnapshot = {
  id: "campaign-ready",
  name: "Sender Recovery Education",
  description: "Explains request approvals, blocks, and demo refunds.",
  targetAudience: "Mailbox admins",
  tags: ["recovery", "requests"],
  timestamp: "2026-06-20T09:00:00Z",
  status: "draft",
  drafts: [
    {
      id: "draft-approval",
      subject: "How request approvals work",
      body: "Use this fake demo copy to explain approvals.",
      recipients: ["admin@stealth.demo"],
    },
  ],
};

describe("campaignPublishChecklist", () => {
  it("marks a complete fake campaign as publishable", () => {
    const result = buildCampaignPublishChecklist(readyCampaign);

    expect(result.canPublish).toBe(true);
    expect(result.blockerCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(summarizeCampaignPublishChecklist(result)).toBe(
      "Sender Recovery Education is ready for mock publish.",
    );
  });

  it("blocks missing campaign identity and empty draft inventory", () => {
    const result = buildCampaignPublishChecklist({
      ...readyCampaign,
      name: "",
      description: "",
      targetAudience: "",
      drafts: [],
    });

    expect(result.canPublish).toBe(false);
    expect(getCampaignPublishBlockers(result).map((item) => item.id)).toEqual([
      "identity",
      "drafts",
      "draft-content",
      "safe-recipients",
    ]);
    expect(summarizeCampaignPublishChecklist(result)).toBe(" has 4 publish blockers.");
  });

  it("blocks real-looking recipient domains", () => {
    const result = buildCampaignPublishChecklist({
      ...readyCampaign,
      drafts: [
        {
          ...readyCampaign.drafts[0],
          recipients: ["person@external.invalid"],
        },
      ],
    });

    expect(result.canPublish).toBe(false);
    expect(getCampaignPublishBlockers(result).map((item) => item.id)).toContain("safe-recipients");
  });

  it("warns for missing tags and archived status without blocking publish", () => {
    const result = buildCampaignPublishChecklist({
      ...readyCampaign,
      tags: [],
      status: "archived",
    });

    expect(result.canPublish).toBe(true);
    expect(getCampaignPublishWarnings(result).map((item) => item.id)).toEqual(["tags", "status"]);
    expect(summarizeCampaignPublishChecklist(result)).toBe(
      "Sender Recovery Education is publishable with 2 warnings.",
    );
  });
});
