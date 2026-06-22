import { describe, it, expect } from "vitest";
import {
  isMessageAssigned,
  getAssignedMessages,
  assignMessage,
  unassignMessage,
  getCampaignsForMessage,
  assignToManyCampaigns,
} from "../utils/assignmentHelpers";
import { CampaignSnapshot } from "../types/campaignSnapshot";
import { AssignableMessage } from "../types/assignment";

const makeMsg = (id: string): AssignableMessage => ({
  id,
  subject: `Subject ${id}`,
  preview: "Preview text",
  body: "Body text",
  recipients: ["test@stealth.demo"],
  tags: ["onboarding"],
  folderHint: "inbox",
});

const makeCampaign = (id: string, draftIds: string[] = []): CampaignSnapshot => ({
  id,
  name: `Campaign ${id}`,
  description: "desc",
  targetAudience: "Test",
  tags: [],
  timestamp: "2026-06-17T00:00:00Z",
  status: "active",
  drafts: draftIds.map((dId) => ({
    id: dId,
    subject: `Draft ${dId}`,
    body: "body",
    recipients: ["r@stealth.demo"],
  })),
});

describe("isMessageAssigned", () => {
  it("returns true when draft id matches", () => {
    const campaign = makeCampaign("c1", ["msg-1", "msg-2"]);
    expect(isMessageAssigned(campaign, "msg-1")).toBe(true);
  });

  it("returns false when draft id is absent", () => {
    const campaign = makeCampaign("c1", ["msg-1"]);
    expect(isMessageAssigned(campaign, "msg-99")).toBe(false);
  });

  it("returns false on empty drafts", () => {
    const campaign = makeCampaign("c1");
    expect(isMessageAssigned(campaign, "msg-1")).toBe(false);
  });
});

describe("getAssignedMessages", () => {
  it("returns pool messages whose ids appear in campaign drafts", () => {
    const campaign = makeCampaign("c1", ["msg-a", "msg-c"]);
    const pool = [makeMsg("msg-a"), makeMsg("msg-b"), makeMsg("msg-c")];
    const result = getAssignedMessages(campaign, pool);
    expect(result.map((m) => m.id)).toEqual(["msg-a", "msg-c"]);
  });

  it("skips draft ids not in the pool", () => {
    const campaign = makeCampaign("c1", ["msg-x"]);
    const pool = [makeMsg("msg-a")];
    expect(getAssignedMessages(campaign, pool)).toHaveLength(0);
  });
});

describe("assignMessage", () => {
  it("adds the message draft to the campaign", () => {
    const campaign = makeCampaign("c1");
    const msg = makeMsg("msg-new");
    const updated = assignMessage(campaign, msg);
    expect(updated.drafts).toHaveLength(1);
    expect(updated.drafts[0].id).toBe("msg-new");
  });

  it("is idempotent — does not duplicate", () => {
    const campaign = makeCampaign("c1", ["msg-new"]);
    const msg = makeMsg("msg-new");
    const updated = assignMessage(campaign, msg);
    expect(updated.drafts).toHaveLength(1);
  });

  it("does not mutate the original campaign", () => {
    const campaign = makeCampaign("c1");
    assignMessage(campaign, makeMsg("msg-x"));
    expect(campaign.drafts).toHaveLength(0);
  });
});

describe("unassignMessage", () => {
  it("removes the draft with the given id", () => {
    const campaign = makeCampaign("c1", ["msg-1", "msg-2"]);
    const updated = unassignMessage(campaign, "msg-1");
    expect(updated.drafts.map((d) => d.id)).toEqual(["msg-2"]);
  });

  it("is a no-op when id is not present", () => {
    const campaign = makeCampaign("c1", ["msg-1"]);
    const updated = unassignMessage(campaign, "msg-99");
    expect(updated.drafts).toHaveLength(1);
  });
});

describe("getCampaignsForMessage", () => {
  it("returns all campaigns that have the message assigned", () => {
    const campaigns = [
      makeCampaign("c1", ["msg-1"]),
      makeCampaign("c2", ["msg-2"]),
      makeCampaign("c3", ["msg-1", "msg-3"]),
    ];
    const result = getCampaignsForMessage(campaigns, "msg-1");
    expect(result.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("returns empty array when no campaign has the message", () => {
    const campaigns = [makeCampaign("c1", ["msg-1"])];
    expect(getCampaignsForMessage(campaigns, "msg-99")).toHaveLength(0);
  });
});

describe("assignToManyCampaigns", () => {
  it("assigns a message to the specified campaign ids only", () => {
    const campaigns = [makeCampaign("c1"), makeCampaign("c2"), makeCampaign("c3")];
    const msg = makeMsg("msg-x");
    const updated = assignToManyCampaigns(campaigns, msg, ["c1", "c3"]);
    expect(isMessageAssigned(updated[0], "msg-x")).toBe(true);
    expect(isMessageAssigned(updated[1], "msg-x")).toBe(false);
    expect(isMessageAssigned(updated[2], "msg-x")).toBe(true);
  });

  it("is idempotent for already-assigned campaigns", () => {
    const campaigns = [makeCampaign("c1", ["msg-x"])];
    const msg = makeMsg("msg-x");
    const updated = assignToManyCampaigns(campaigns, msg, ["c1"]);
    expect(updated[0].drafts).toHaveLength(1);
  });
});
