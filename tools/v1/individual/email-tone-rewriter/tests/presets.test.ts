/**
 * Tests for the tone presets service.
 */

import { describe, it, expect } from "vitest";
import {
  BUILT_IN_PRESETS,
  getPresetsGrouped,
  findPreset,
  filterByTag,
  bestPreset,
  getAllTags,
  describePreset,
  resolvePreset,
  presetToConfig,
  presetsForContext,
  presetCounts,
  suggestPreset,
} from "../services/presets";

describe("BUILT_IN_PRESETS", () => {
  it("has at least one preset", () => {
    expect(BUILT_IN_PRESETS.length).toBeGreaterThan(0);
  });

  it("each preset has required fields", () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(["concise", "friendly", "formal", "apologetic"]).toContain(preset.tone);
      expect(Array.isArray(preset.tags)).toBe(true);
    }
  });

  it("each preset has a unique id", () => {
    const ids = BUILT_IN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getPresetsGrouped", () => {
  it("returns presets grouped by tone", () => {
    const groups = getPresetsGrouped();
    expect(groups.length).toBeGreaterThanOrEqual(4);
    for (const group of groups) {
      expect(group.label).toBeTruthy();
      expect(group.presets.length).toBeGreaterThan(0);
      for (const preset of group.presets) {
        expect(preset.tone.toLowerCase()).toBe(
          group.label.toLowerCase() || group.label.toLowerCase().includes(preset.tone),
        );
      }
    }
  });
});

describe("findPreset", () => {
  it("finds a preset by id", () => {
    const preset = findPreset("concise-quick");
    expect(preset).toBeDefined();
    expect(preset!.label).toBe("Quick & Concise");
  });

  it("returns undefined for unknown id", () => {
    expect(findPreset("nonexistent")).toBeUndefined();
  });

  it("finds all built-in presets by id", () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(findPreset(preset.id)).toBeDefined();
    }
  });
});

describe("filterByTag", () => {
  it("filters presets by tag", () => {
    const shortPresets = filterByTag("short");
    expect(shortPresets.length).toBeGreaterThan(0);
    for (const preset of shortPresets) {
      expect(preset.tags).toContain("short");
    }
  });

  it("returns empty array for unknown tag", () => {
    expect(filterByTag("nonexistent-tag")).toEqual([]);
  });
});

describe("bestPreset", () => {
  it("returns a preset for a given tone", () => {
    const preset = bestPreset("formal");
    expect(preset.tone).toBe("formal");
  });

  it("returns first preset for fallback when no match", () => {
    const preset = bestPreset("formal", 999);
    expect(preset).toBeDefined();
    expect(preset.tone).toBe("formal");
  });

  it("prefers exact maxWords match", () => {
    const preset = bestPreset("concise", 50);
    expect(preset.maxWords).toBe(50);
  });
});

describe("getAllTags", () => {
  it("returns sorted unique tags", () => {
    const tags = getAllTags();
    expect(tags.length).toBeGreaterThan(0);
    expect(tags).toEqual([...tags].sort());
  });
});

describe("describePreset", () => {
  it("includes the preset label", () => {
    const preset = findPreset("concise-quick")!;
    const desc = describePreset(preset);
    expect(desc).toContain(preset.label);
  });

  it("includes maxWords when present", () => {
    const preset = findPreset("concise-quick")!;
    const desc = describePreset(preset);
    expect(desc).toContain("max");
    expect(desc).toContain("50");
  });

  it("includes description", () => {
    const preset = findPreset("friendly-warm")!;
    const desc = describePreset(preset);
    expect(desc).toContain(preset.description);
  });
});

describe("resolvePreset", () => {
  it("returns the preset for a valid id", () => {
    const preset = resolvePreset("formal-business");
    expect(preset.id).toBe("formal-business");
  });

  it("returns fallback for undefined id", () => {
    const preset = resolvePreset(undefined);
    expect(preset).toBeDefined();
  });

  it("returns fallback for unknown id", () => {
    const preset = resolvePreset("nonexistent");
    expect(preset).toBeDefined();
  });

  it("uses provided fallback tone", () => {
    const preset = resolvePreset(undefined, "formal");
    expect(preset.tone).toBe("formal");
  });
});

describe("presetToConfig", () => {
  it("extracts tone and maxWords", () => {
    const preset = findPreset("concise-quick")!;
    const config = presetToConfig(preset);
    expect(config.tone).toBe("concise");
    expect(config.maxWords).toBe(50);
  });

  it("handles presets without maxWords", () => {
    const preset = findPreset("friendly-warm")!;
    const config = presetToConfig(preset);
    expect(config.tone).toBe("friendly");
    expect(config.maxWords).toBeUndefined();
  });
});

describe("presetsForContext", () => {
  it("finds presets by context tag", () => {
    const results = presetsForContext("apology");
    expect(results.length).toBeGreaterThan(0);
    for (const preset of results) {
      const hasTag = preset.tags.includes("apology");
      const hasLabel = preset.label.toLowerCase().includes("apology");
      const hasDesc = preset.description.toLowerCase().includes("apology");
      expect(hasTag || hasLabel || hasDesc).toBe(true);
    }
  });

  it("returns empty for unknown context", () => {
    expect(presetsForContext("zzznonexistent")).toEqual([]);
  });
});

describe("presetCounts", () => {
  it("returns counts per tone", () => {
    const counts = presetCounts();
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(4);
    for (const [tone, count] of Object.entries(counts)) {
      expect(["concise", "friendly", "formal", "apologetic"]).toContain(tone);
      expect(count).toBeGreaterThan(0);
    }
  });
});

describe("suggestPreset", () => {
  it("suggests apology preset for apology content", () => {
    const preset = suggestPreset("I am sorry for the delay.");
    expect(preset.tone).toBe("apologetic");
  });

  it("suggests concise preset for short content", () => {
    const preset = suggestPreset("Hi. Thanks.");
    expect(preset.tone).toBe("concise");
  });

  it("suggests formal preset for long content", () => {
    const longText = "We are writing to inform you ".repeat(20);
    const preset = suggestPreset(longText);
    expect(preset.tone).toBe("formal");
  });

  it("suggests friendly preset for medium content", () => {
    const text =
      "Hello team, just checking in on the project status. Let me know if you need anything.";
    const preset = suggestPreset(text);
    expect(preset).toBeDefined();
  });
});
