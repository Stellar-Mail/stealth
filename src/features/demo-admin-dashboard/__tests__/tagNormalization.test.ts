import { describe, expect, it } from "vitest";
import type { CampaignTag } from "../types/campaignTag";
import {
  assignTagOrders,
  normalizeTagColor,
  normalizeTagName,
  normalizeCampaignTag,
  normalizeCampaignTags,
  resolveTagSlug,
  toTagSlug,
} from "../utils/tagNormalization";

describe("normalizeTagName", () => {
  it("lowercases input", () => {
    expect(normalizeTagName("HELLO")).toBe("hello");
  });
  it("trims leading and trailing whitespace", () => {
    expect(normalizeTagName("  hello  ")).toBe("hello");
  });
  it("collapses internal whitespace", () => {
    expect(normalizeTagName("my  tag")).toBe("my tag");
  });
  it("handles empty string", () => {
    expect(normalizeTagName("")).toBe("");
  });
  it("preserves single spaces between words", () => {
    expect(normalizeTagName("my tag")).toBe("my tag");
  });
});

describe("toTagSlug", () => {
  it("converts spaces to hyphens", () => {
    expect(toTagSlug("my tag")).toBe("my-tag");
  });
  it("strips special characters", () => {
    expect(toTagSlug("hello!")).toBe("hello");
  });
  it("removes leading and trailing hyphens", () => {
    expect(toTagSlug("!hello!")).toBe("hello");
  });
  it("collapses multiple consecutive spaces", () => {
    expect(toTagSlug("hello   world")).toBe("hello-world");
  });
  it("lowercases the output", () => {
    expect(toTagSlug("MyTag")).toBe("mytag");
  });
  it("handles already-slugified input unchanged", () => {
    expect(toTagSlug("onboarding")).toBe("onboarding");
  });
  it("strips non-alphanumeric characters between words", () => {
    expect(toTagSlug("hello & world")).toBe("hello-world");
  });
});

describe("resolveTagSlug", () => {
  it("returns base slug when no collision", () => {
    expect(resolveTagSlug("onboarding", [])).toBe("onboarding");
  });
  it("appends -2 on first collision", () => {
    expect(resolveTagSlug("onboarding", ["onboarding"])).toBe("onboarding-2");
  });
  it("increments suffix until unique", () => {
    expect(resolveTagSlug("onboarding", ["onboarding", "onboarding-2"])).toBe("onboarding-3");
  });
  it("is case-insensitive — normalizes name before slug generation", () => {
    expect(resolveTagSlug("Onboarding", ["onboarding"])).toBe("onboarding-2");
  });
});

describe("normalizeTagColor", () => {
  const knownColors = [
    "onboarding",
    "welcome",
    "stellar",
    "security",
    "alert",
    "newsletter",
    "marketing",
    "announcement",
    "default",
  ] as const;

  it("passes through all known TagColorKey values unchanged", () => {
    for (const color of knownColors) {
      expect(normalizeTagColor(color)).toBe(color);
    }
  });

  it("falls back to default for an unknown string", () => {
    expect(normalizeTagColor("purple")).toBe("default");
  });

  it("falls back to default for an empty string", () => {
    expect(normalizeTagColor("")).toBe("default");
  });

  it("falls back to default for a number", () => {
    expect(normalizeTagColor(42)).toBe("default");
  });

  it("falls back to default for null", () => {
    expect(normalizeTagColor(null)).toBe("default");
  });

  it("falls back to default for undefined", () => {
    expect(normalizeTagColor(undefined)).toBe("default");
  });
});

describe("assignTagOrders", () => {
  it("assigns 1-based ranks in alphabetical order by name", () => {
    const tags: CampaignTag[] = [
      { id: "1", name: "zebra", color: "default" },
      { id: "2", name: "apple", color: "default" },
      { id: "3", name: "mango", color: "default" },
    ];
    const result = assignTagOrders(tags);
    expect(result.find((t) => t.name === "apple")?.order).toBe(1);
    expect(result.find((t) => t.name === "mango")?.order).toBe(2);
    expect(result.find((t) => t.name === "zebra")?.order).toBe(3);
  });

  it("does not mutate the input array", () => {
    const tags: CampaignTag[] = [
      { id: "1", name: "b", color: "default" },
      { id: "2", name: "a", color: "default" },
    ];
    assignTagOrders(tags);
    expect(tags[0].name).toBe("b");
  });

  it("assigns order 1 to a single tag", () => {
    const tags: CampaignTag[] = [{ id: "1", name: "only", color: "default" }];
    expect(assignTagOrders(tags)[0].order).toBe(1);
  });

  it("sorts case-insensitively", () => {
    const tags: CampaignTag[] = [
      { id: "1", name: "Beta", color: "default" },
      { id: "2", name: "alpha", color: "default" },
    ];
    const result = assignTagOrders(tags);
    expect(result.find((t) => t.name === "alpha")?.order).toBe(1);
    expect(result.find((t) => t.name === "Beta")?.order).toBe(2);
  });
});

describe("normalizeCampaignTag", () => {
  it("normalizes name to lowercase and trimmed", () => {
    const tag: CampaignTag = { id: "1", name: "  Hello  ", color: "default" };
    expect(normalizeCampaignTag(tag).name).toBe("hello");
  });

  it("generates a slug from the name", () => {
    const tag: CampaignTag = { id: "1", name: "my tag", color: "default" };
    expect(normalizeCampaignTag(tag).slug).toBe("my-tag");
  });

  it("resolves slug collision using existingSlugs", () => {
    const tag: CampaignTag = { id: "1", name: "tag", color: "default" };
    expect(normalizeCampaignTag(tag, ["tag"]).slug).toBe("tag-2");
  });

  it("validates and preserves known color", () => {
    const tag: CampaignTag = { id: "1", name: "test", color: "stellar" };
    expect(normalizeCampaignTag(tag).color).toBe("stellar");
  });

  it("coerces unknown color to default", () => {
    const tag: CampaignTag = { id: "1", name: "test", color: "invalid" as never };
    expect(normalizeCampaignTag(tag).color).toBe("default");
  });
});

describe("normalizeCampaignTags", () => {
  it("generates unique slugs across the entire set", () => {
    const tags: CampaignTag[] = [
      { id: "1", name: "Tag", color: "default" },
      { id: "2", name: "Tag", color: "default" },
    ];
    const result = normalizeCampaignTags(tags);
    const slugs = result.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(2);
    expect(slugs).toContain("tag");
    expect(slugs).toContain("tag-2");
  });

  it("assigns an order to every tag", () => {
    const tags: CampaignTag[] = [
      { id: "1", name: "b", color: "default" },
      { id: "2", name: "a", color: "default" },
    ];
    const result = normalizeCampaignTags(tags);
    expect(result.every((t) => t.order !== undefined)).toBe(true);
  });

  it("orders tags alphabetically by name", () => {
    const tags: CampaignTag[] = [
      { id: "1", name: "zebra", color: "default" },
      { id: "2", name: "ant", color: "default" },
    ];
    const result = normalizeCampaignTags(tags);
    expect(result.find((t) => t.name === "ant")?.order).toBe(1);
    expect(result.find((t) => t.name === "zebra")?.order).toBe(2);
  });

  it("validates all colors, falling back to default for invalid ones", () => {
    const tags: CampaignTag[] = [
      { id: "1", name: "valid", color: "onboarding" },
      { id: "2", name: "invalid", color: "bogus" as never },
    ];
    const result = normalizeCampaignTags(tags);
    expect(result.find((t) => t.name === "valid")?.color).toBe("onboarding");
    expect(result.find((t) => t.name === "invalid")?.color).toBe("default");
  });

  it("does not mutate the input array", () => {
    const tags: CampaignTag[] = [{ id: "1", name: "Test", color: "default" }];
    normalizeCampaignTags(tags);
    expect(tags[0].name).toBe("Test");
    expect(tags[0].slug).toBeUndefined();
    expect(tags[0].order).toBeUndefined();
  });
});
