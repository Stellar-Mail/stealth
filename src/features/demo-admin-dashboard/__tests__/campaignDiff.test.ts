import { describe, expect, it } from "vitest";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import {
  compareCampaignSnapshots,
  formatCampaignDiffSummary,
  getCampaignDiffEntriesByKind,
} from "../campaignDiff";

const baseCampaign: CampaignSnapshot = {
  id: "campaign-base",
  name: "Sender Recovery Education",
  description: "Explains sender request recovery.",
  targetAudience: "Mailbox admins",
  tags: ["recovery", "requests"],
  timestamp: "2026-06-20T09:00:00Z",
  status: "draft",
  drafts: [
    {
      id: "draft-approval",
      subject: "How request approvals work",
      body: "Use demo copy to explain approvals.",
      recipients: ["admin@stealth.demo"],
    },
    {
      id: "draft-followup",
      subject: "Follow up with senders",
      body: "Share a safe fake sender follow-up.",
      recipients: ["ops@stealth.demo"],
    },
  ],
};

describe("campaignDiff", () => {
  it("reports no changes for identical campaign snapshots", () => {
    const result = compareCampaignSnapshots(baseCampaign, {
      ...baseCampaign,
      id: "campaign-copy",
      tags: [...baseCampaign.tags].reverse(),
      drafts: [...baseCampaign.drafts],
    });

    expect(result.hasChanges).toBe(false);
    expect(result.summary.changed).toBe(0);
    expect(result.summary.added).toBe(0);
    expect(result.summary.removed).toBe(0);
    expect(formatCampaignDiffSummary(result)).toBe("No campaign changes detected.");
  });

  it("tracks metadata changes", () => {
    const result = compareCampaignSnapshots(baseCampaign, {
      ...baseCampaign,
      name: "Sender Recovery Relaunch",
      targetAudience: "Support operators",
      status: "needs-review",
    });

    expect(getCampaignDiffEntriesByKind(result, "changed").map((entry) => entry.id)).toEqual([
      "metadata-name",
      "metadata-targetAudience",
      "metadata-status",
    ]);
    expect(formatCampaignDiffSummary(result)).toBe("Review 3 changed campaign differences.");
  });

  it("tracks tag additions and removals", () => {
    const result = compareCampaignSnapshots(baseCampaign, {
      ...baseCampaign,
      tags: ["requests", "launch"],
    });

    expect(getCampaignDiffEntriesByKind(result, "added").map((entry) => entry.label)).toEqual([
      "Tag: launch",
    ]);
    expect(getCampaignDiffEntriesByKind(result, "removed").map((entry) => entry.label)).toEqual([
      "Tag: recovery",
    ]);
  });

  it("tracks added, removed, and changed drafts", () => {
    const result = compareCampaignSnapshots(baseCampaign, {
      ...baseCampaign,
      drafts: [
        {
          ...baseCampaign.drafts[0],
          body: "Updated demo copy to explain approvals and evidence capture.",
        },
        {
          id: "draft-new",
          subject: "Escalation checklist",
          body: "Explain escalation paths with fake demo records.",
          recipients: ["lead@stealth.demo"],
        },
      ],
    });

    expect(getCampaignDiffEntriesByKind(result, "changed").map((entry) => entry.id)).toContain(
      "draft-changed-draft-approval",
    );
    expect(getCampaignDiffEntriesByKind(result, "removed").map((entry) => entry.id)).toContain(
      "draft-removed-draft-followup",
    );
    expect(getCampaignDiffEntriesByKind(result, "added").map((entry) => entry.id)).toContain(
      "draft-added-draft-new",
    );
  });
});
