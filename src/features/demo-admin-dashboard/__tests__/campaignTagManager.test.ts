import { describe, expect, it } from "vitest";
import {
  createTag,
  deleteTag,
  getTagUsageCount,
  mergeTag,
  renameTag,
  updateTagColor,
} from "../utils/tagOperations";
import type { CampaignTag } from "../types/campaignTag";
import type { CampaignSnapshot } from "../types/campaignSnapshot";

const baseTags: CampaignTag[] = [
  { id: "tag-1", name: "onboarding", color: "onboarding" },
  { id: "tag-2", name: "newsletter", color: "newsletter" },
  { id: "tag-3", name: "security", color: "security" },
];

const baseSnapshots: CampaignSnapshot[] = [
  {
    id: "snap-1",
    name: "Campaign A",
    description: "desc",
    targetAudience: "all",
    tags: ["onboarding", "newsletter"],
    timestamp: "2026-06-01T00:00:00Z",
    drafts: [],
  },
  {
    id: "snap-2",
    name: "Campaign B",
    description: "desc",
    targetAudience: "all",
    tags: ["onboarding"],
    timestamp: "2026-06-02T00:00:00Z",
    drafts: [],
  },
  {
    id: "snap-3",
    name: "Campaign C",
    description: "desc",
    targetAudience: "all",
    tags: ["security"],
    timestamp: "2026-06-03T00:00:00Z",
    drafts: [],
  },
];

describe("createTag", () => {
  it("creates a new tag successfully", () => {
    const result = createTag(baseTags, "marketing", "marketing");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tags).toHaveLength(baseTags.length + 1);
    expect(result.tags.find((t) => t.name === "marketing")).toBeDefined();
  });

  it("rejects a duplicate name (exact match)", () => {
    const result = createTag(baseTags, "onboarding", "onboarding");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it("rejects a duplicate name (case-insensitive)", () => {
    const result = createTag(baseTags, "Onboarding", "onboarding");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = createTag(baseTags, "  ", "onboarding");
    expect(result.ok).toBe(false);
  });
});

describe("renameTag", () => {
  it("renames a tag successfully", () => {
    const result = renameTag(baseTags, "tag-1", "new-name");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tags.find((t) => t.id === "tag-1")?.name).toBe("new-name");
  });

  it("rejects rename to an existing name (case-insensitive)", () => {
    const result = renameTag(baseTags, "tag-1", "Newsletter");
    expect(result.ok).toBe(false);
  });

  it("allows self-rename (same name)", () => {
    const result = renameTag(baseTags, "tag-1", "onboarding");
    expect(result.ok).toBe(true);
  });

  it("rejects empty name", () => {
    const result = renameTag(baseTags, "tag-1", "");
    expect(result.ok).toBe(false);
  });
});

describe("updateTagColor", () => {
  it("updates the color of a tag", () => {
    const updated = updateTagColor(baseTags, "tag-1", "alert");
    expect(updated.find((t) => t.id === "tag-1")?.color).toBe("alert");
  });

  it("leaves other tags unchanged", () => {
    const updated = updateTagColor(baseTags, "tag-1", "alert");
    expect(updated.find((t) => t.id === "tag-2")?.color).toBe("newsletter");
  });
});

describe("mergeTag", () => {
  it("removes the source tag from the registry", () => {
    const { tags } = mergeTag(baseTags, baseSnapshots, "tag-1", "tag-2");
    expect(tags.find((t) => t.id === "tag-1")).toBeUndefined();
  });

  it("keeps the target tag in the registry", () => {
    const { tags } = mergeTag(baseTags, baseSnapshots, "tag-1", "tag-2");
    expect(tags.find((t) => t.id === "tag-2")).toBeDefined();
  });

  it("replaces source tag name with target name in all snapshots", () => {
    const { snapshots } = mergeTag(baseTags, baseSnapshots, "tag-1", "tag-2");
    // snap-1 and snap-2 had "onboarding" — should now have "newsletter"
    expect(snapshots[0].tags).toContain("newsletter");
    expect(snapshots[0].tags).not.toContain("onboarding");
    expect(snapshots[1].tags).toContain("newsletter");
    expect(snapshots[1].tags).not.toContain("onboarding");
    // snap-3 did not have "onboarding", untouched
    expect(snapshots[2].tags).toEqual(["security"]);
  });
});

describe("deleteTag", () => {
  it("removes the tag from the registry", () => {
    const { tags } = deleteTag(baseTags, baseSnapshots, "tag-1");
    expect(tags.find((t) => t.id === "tag-1")).toBeUndefined();
  });

  it("strips the tag name from all snapshot tags arrays", () => {
    const { snapshots } = deleteTag(baseTags, baseSnapshots, "tag-1");
    expect(snapshots[0].tags).not.toContain("onboarding");
    expect(snapshots[1].tags).not.toContain("onboarding");
    // snap-3 never had it
    expect(snapshots[2].tags).toEqual(["security"]);
  });

  it("returns unchanged state for unknown id", () => {
    const { tags, snapshots } = deleteTag(baseTags, baseSnapshots, "tag-unknown");
    expect(tags).toEqual(baseTags);
    expect(snapshots).toEqual(baseSnapshots);
  });
});

describe("getTagUsageCount", () => {
  it("returns the number of snapshots containing the tag name", () => {
    expect(getTagUsageCount(baseSnapshots, "onboarding")).toBe(2);
  });

  it("returns 1 for a tag used in exactly one snapshot", () => {
    expect(getTagUsageCount(baseSnapshots, "security")).toBe(1);
  });

  it("returns 0 for a tag not used in any snapshot", () => {
    expect(getTagUsageCount(baseSnapshots, "marketing")).toBe(0);
  });

  it("counts correctly across multiple snapshots with overlapping tags", () => {
    expect(getTagUsageCount(baseSnapshots, "newsletter")).toBe(1);
  });
});
