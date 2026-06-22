import { describe, expect, it } from "vitest";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import {
  campaignEditorStateToSnapshot,
  campaignToEditorState,
  emptyCampaignEditorState,
  getCampaignEditorEmptyState,
  normalizeCampaignEditorTags,
  validateCampaignEditorState,
} from "../campaignEditor";

const campaign: CampaignSnapshot = {
  id: "snap-sender-recovery",
  name: "Sender Recovery Education",
  description: "Explains request recovery with fake demo records.",
  targetAudience: "Mailbox admins",
  tags: ["recovery", "requests"],
  timestamp: "2026-06-20T09:00:00Z",
  status: "needs-review",
  drafts: [
    {
      id: "draft-recovery",
      subject: "Review sender recovery",
      body: "Use fake evidence to explain recovery.",
      recipients: ["admin@stealth.demo"],
    },
  ],
};

describe("campaignEditor", () => {
  it("normalizes campaign snapshots into editable form state", () => {
    const state = campaignToEditorState(campaign);

    expect(state.name).toBe(campaign.name);
    expect(state.tagsInput).toBe("recovery, requests");
    expect(state.status).toBe("needs-review");
    expect(state.drafts).toEqual(campaign.drafts);
  });

  it("validates required campaign metadata and warns about shell-only gaps", () => {
    const result = validateCampaignEditorState(emptyCampaignEditorState);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "Campaign name is required.",
      "Description is required.",
      "Target audience is required.",
    ]);
    expect(result.warnings).toEqual([
      "No demo drafts are attached yet.",
      "Add at least one campaign tag for easier filtering.",
    ]);
  });

  it("builds deterministic fake campaign snapshots from editor state", () => {
    const snapshot = campaignEditorStateToSnapshot(
      {
        ...emptyCampaignEditorState,
        name: "Sender Recovery Education",
        description: "Explains request recovery with fake demo records.",
        targetAudience: "Mailbox admins",
        tagsInput: "Recovery, requests, recovery",
        drafts: campaign.drafts,
      },
      new Set(["snap-sender-recovery-education"]),
      "2026-06-20T10:00:00Z",
    );

    expect(snapshot.id).toBe("snap-sender-recovery-education-2");
    expect(snapshot.tags).toEqual(["recovery", "requests"]);
    expect(snapshot.timestamp).toBe("2026-06-20T10:00:00Z");
    expect(snapshot.drafts[0]).not.toBe(campaign.drafts[0]);
  });

  it("provides empty state copy for blank and draftless shells", () => {
    expect(getCampaignEditorEmptyState(emptyCampaignEditorState)?.title).toBe(
      "Start a campaign draft",
    );
    expect(
      getCampaignEditorEmptyState({
        ...emptyCampaignEditorState,
        name: "Sender Recovery",
      })?.title,
    ).toBe("No demo drafts attached");
    expect(getCampaignEditorEmptyState(campaignToEditorState(campaign))).toBeNull();
  });

  it("deduplicates normalized campaign tags", () => {
    expect(normalizeCampaignEditorTags(" Recovery,requests,,RECOVERY ")).toEqual([
      "recovery",
      "requests",
    ]);
  });
});
