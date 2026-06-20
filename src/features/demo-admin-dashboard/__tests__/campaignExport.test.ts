import { describe, expect, it } from "vitest";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import type { CampaignSnapshotExport } from "../types/campaignExport";
import { CAMPAIGN_EXPORT_SCHEMA_VERSION } from "../types/campaignExport";
import {
  buildCampaignExport,
  serializeCampaignSnapshot,
  buildCampaignExportFilename,
} from "../helpers/campaignExport";

const snapshot: CampaignSnapshot = {
  id: "snap-welcome",
  name: "Welcome series",
  description: "Onboarding drips for new demo accounts.",
  targetAudience: "New signups",
  tags: ["onboarding", "welcome", "onboarding"],
  timestamp: "2026-01-01T00:00:00.000Z",
  status: "active",
  drafts: [
    {
      id: "draft-2",
      subject: "Day 2: getting started",
      body: "Here is how to send your first message.",
      recipients: ["bob@example.com"],
    },
    {
      id: "draft-1",
      subject: "Day 1: welcome",
      body: "Thanks for joining the demo.",
      recipients: ["alice@example.com"],
    },
  ],
};

describe("buildCampaignExport", () => {
  it("includes the schema version and campaign metadata", () => {
    const result = buildCampaignExport(snapshot);
    expect(result.version).toBe(CAMPAIGN_EXPORT_SCHEMA_VERSION);
    expect(result.campaign.id).toBe("snap-welcome");
    expect(result.campaign.status).toBe("active");
    expect(result.draftCount).toBe(2);
  });

  it("sorts drafts by id for stable ordering", () => {
    const result = buildCampaignExport(snapshot);
    expect(result.drafts.map((draft) => draft.id)).toEqual(["draft-1", "draft-2"]);
  });

  it("de-duplicates and sorts tags", () => {
    const result = buildCampaignExport(snapshot);
    expect(result.campaign.tags).toEqual(["onboarding", "welcome"]);
  });

  it("defaults status to draft when it is missing", () => {
    const result = buildCampaignExport({
      id: "snap-empty",
      name: "No status",
      description: "Snapshot without an explicit status.",
      targetAudience: "Everyone",
      tags: [],
      timestamp: "2026-01-01T00:00:00.000Z",
      drafts: [],
    });
    expect(result.campaign.status).toBe("draft");
  });

  it("copies only known draft fields", () => {
    const result = buildCampaignExport(snapshot);
    const keys = Object.keys(result.drafts[0] ?? {}).sort();
    expect(keys).toEqual(["body", "id", "recipients", "subject"]);
  });
});

describe("serializeCampaignSnapshot", () => {
  it("produces deterministic JSON ending in a newline", () => {
    const json = serializeCampaignSnapshot(snapshot);
    expect(json.endsWith("\n")).toBe(true);
    expect(json).toBe(serializeCampaignSnapshot(snapshot));

    const parsed = JSON.parse(json) as CampaignSnapshotExport;
    expect(parsed.campaign.tags).toEqual(["onboarding", "welcome"]);
    expect(parsed.drafts.map((draft) => draft.id)).toEqual(["draft-1", "draft-2"]);
  });
});

describe("buildCampaignExportFilename", () => {
  it("builds a deterministic UTC filename", () => {
    const filename = buildCampaignExportFilename(snapshot, new Date("2026-06-19T18:30:00.000Z"));
    expect(filename).toBe("campaign-export-snap-welcome-2026-06-19.json");
  });
});
