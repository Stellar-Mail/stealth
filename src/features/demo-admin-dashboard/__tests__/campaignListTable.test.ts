import { describe, expect, it } from "vitest";
import { defaultCampaignSnapshots } from "../fixtures/campaignSnapshotFixtures";
import {
  buildCampaignListRows,
  clearCampaignSelection,
  defaultCampaignListSort,
  nextCampaignListSort,
  selectAllCampaigns,
  summarizeCampaignSelection,
  toggleCampaignSelection,
} from "../campaignListTable";

describe("campaignListTable", () => {
  it("builds sorted rows with selection state", () => {
    const rows = buildCampaignListRows(defaultCampaignSnapshots, ["snap-security"]);

    expect(rows.map((row) => row.id)).toEqual(["snap-welcome", "snap-security", "snap-newsletter"]);
    expect(rows.find((row) => row.id === "snap-security")?.selected).toBe(true);
    expect(rows[0].draftCount).toBe(2);
  });

  it("sorts by campaign name in ascending order", () => {
    const rows = buildCampaignListRows(defaultCampaignSnapshots, [], {
      key: "name",
      direction: "asc",
    });

    expect(rows.map((row) => row.name)).toEqual([
      "Monthly Newsletter",
      "Security Auditing Flow",
      "Welcome Onboarding Series",
    ]);
  });

  it("toggles and clears campaign selection deterministically", () => {
    expect(toggleCampaignSelection(["snap-security"], "snap-welcome")).toEqual([
      "snap-security",
      "snap-welcome",
    ]);
    expect(toggleCampaignSelection(["snap-security"], "snap-security")).toEqual([]);
    expect(selectAllCampaigns(defaultCampaignSnapshots)).toEqual([
      "snap-newsletter",
      "snap-security",
      "snap-welcome",
    ]);
    expect(clearCampaignSelection()).toEqual([]);
  });

  it("summarizes only selected ids that exist in the current campaign list", () => {
    const summary = summarizeCampaignSelection(defaultCampaignSnapshots, [
      "snap-security",
      "missing",
    ]);

    expect(summary).toEqual({
      selectedCount: 1,
      totalCount: 3,
      selectedIds: ["snap-security"],
      hasSelection: true,
    });
  });

  it("toggles sort direction for the same key and defaults new numeric keys to desc", () => {
    expect(nextCampaignListSort(defaultCampaignListSort, "updated")).toEqual({
      key: "updated",
      direction: "asc",
    });
    expect(nextCampaignListSort(defaultCampaignListSort, "drafts")).toEqual({
      key: "drafts",
      direction: "desc",
    });
    expect(nextCampaignListSort(defaultCampaignListSort, "name")).toEqual({
      key: "name",
      direction: "asc",
    });
  });
});
