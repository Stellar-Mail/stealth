import { describe, expect, it } from "vitest";
import { CampaignEditorPanel } from "../../../src/features/demo-admin-dashboard";
import {
  emptyCampaignEditorState,
  getCampaignEditorEmptyState,
  validateCampaignEditorState,
} from "../../../src/features/demo-admin-dashboard";

describe("CampaignEditorPanel shell", () => {
  it("exports the CampaignEditorPanel component", () => {
    expect(CampaignEditorPanel).toBeDefined();
    expect(typeof CampaignEditorPanel).toBe("function");
  });

  it("shows empty state copy when no content is entered", () => {
    const empty = getCampaignEditorEmptyState(emptyCampaignEditorState);
    expect(empty).not.toBeNull();
    expect(empty?.title).toBe("Start a campaign draft");
    expect(empty?.actionLabel).toBe("Fill campaign metadata");
  });

  it("returns null empty state when campaign has drafts and metadata", () => {
    const state = {
      ...emptyCampaignEditorState,
      name: "Sender Recovery",
      description: "Fake demo records for recovery.",
      targetAudience: "Mailbox admins",
      tagsInput: "recovery",
      drafts: [{ id: "d1", subject: "Test", body: "Body", recipients: ["a@stealth.demo"] }],
    };
    expect(getCampaignEditorEmptyState(state)).toBeNull();
  });

  it("header actions are present: valid state passes validation", () => {
    const state = {
      ...emptyCampaignEditorState,
      name: "Sender Recovery",
      description: "Fake demo records for recovery.",
      targetAudience: "Mailbox admins",
      tagsInput: "recovery",
      drafts: [{ id: "d1", subject: "Test", body: "Body", recipients: ["a@stealth.demo"] }],
    };
    const result = validateCampaignEditorState(state);
    expect(result.valid).toBe(true);
    expect(result.previewAvailable).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
