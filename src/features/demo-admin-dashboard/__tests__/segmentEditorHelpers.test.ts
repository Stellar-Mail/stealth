import { describe, it, expect } from "vitest";
import {
  initEditorState,
  updateSegmentLabel,
  updateSegmentDescription,
  addCriteria,
  removeCriteria,
  validateSegment,
} from "../utils/segmentEditorHelpers";
import { defaultAudienceSegments } from "../fixtures/audienceSegmentFixtures";
import type { EditableSegment } from "../types/segmentEditorState";

function makeSegment(overrides: Partial<EditableSegment> = {}): EditableSegment {
  return {
    ...defaultAudienceSegments[0],
    personaIds: [],
    ...overrides,
  };
}

describe("initEditorState", () => {
  it("wraps all base segments with personaIds: []", () => {
    const state = initEditorState(defaultAudienceSegments);
    expect(state.segments).toHaveLength(defaultAudienceSegments.length);
    for (const seg of state.segments) {
      expect(seg.personaIds).toEqual([]);
    }
  });

  it("preserves all original segment fields", () => {
    const state = initEditorState(defaultAudienceSegments);
    expect(state.segments[0].id).toBe(defaultAudienceSegments[0].id);
    expect(state.segments[0].label).toBe(defaultAudienceSegments[0].label);
  });
});

describe("updateSegmentLabel", () => {
  it("returns a new segment with the updated label", () => {
    const seg = makeSegment({ label: "Old" });
    const updated = updateSegmentLabel(seg, "New Label");
    expect(updated.label).toBe("New Label");
    expect(seg.label).toBe("Old");
  });
});

describe("updateSegmentDescription", () => {
  it("returns a new segment with the updated description", () => {
    const seg = makeSegment({ description: "Old desc" });
    const updated = updateSegmentDescription(seg, "New desc");
    expect(updated.description).toBe("New desc");
  });
});

describe("addCriteria", () => {
  it("appends a trimmed criterion", () => {
    const seg = makeSegment({ criteria: ["existing"] });
    const updated = addCriteria(seg, "  new criterion  ");
    expect(updated.criteria).toEqual(["existing", "new criterion"]);
  });

  it("ignores empty strings", () => {
    const seg = makeSegment({ criteria: [] });
    const updated = addCriteria(seg, "   ");
    expect(updated).toBe(seg);
    expect(updated.criteria).toHaveLength(0);
  });

  it("ignores an empty criterion after trim", () => {
    const seg = makeSegment({ criteria: ["a"] });
    const updated = addCriteria(seg, "");
    expect(updated).toBe(seg);
  });
});

describe("removeCriteria", () => {
  it("removes the criterion at the given index", () => {
    const seg = makeSegment({ criteria: ["a", "b", "c"] });
    const updated = removeCriteria(seg, 1);
    expect(updated.criteria).toEqual(["a", "c"]);
  });

  it("leaves the array unchanged for an out-of-range index", () => {
    const seg = makeSegment({ criteria: ["a"] });
    const updated = removeCriteria(seg, 5);
    expect(updated.criteria).toEqual(["a"]);
  });
});

describe("validateSegment", () => {
  it("returns valid: true for a fully valid segment", () => {
    const seg = makeSegment({
      label: "Valid Label",
      criteria: ["at least one"],
      personaIds: ["persona-01"],
    });
    const result = validateSegment(seg);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("errors on empty label", () => {
    const seg = makeSegment({ label: "" });
    const result = validateSegment(seg);
    const err = result.errors.find((e) => e.field === "label");
    expect(err).toBeDefined();
    expect(err?.severity).toBe("error");
    expect(result.valid).toBe(false);
  });

  it("errors on label exceeding 50 characters", () => {
    const seg = makeSegment({ label: "A".repeat(51) });
    const result = validateSegment(seg);
    const err = result.errors.find((e) => e.field === "label");
    expect(err?.severity).toBe("error");
    expect(result.valid).toBe(false);
  });

  it("warns on empty criteria", () => {
    const seg = makeSegment({ label: "OK", criteria: [], personaIds: ["persona-01"] });
    const result = validateSegment(seg);
    const warn = result.errors.find((e) => e.field === "criteria");
    expect(warn).toBeDefined();
    expect(warn?.severity).toBe("warning");
    expect(result.valid).toBe(true);
  });

  it("informs when no personas are assigned", () => {
    const seg = makeSegment({ label: "OK", criteria: ["x"], personaIds: [] });
    const result = validateSegment(seg);
    const info = result.errors.find((e) => e.field === "personas");
    expect(info).toBeDefined();
    expect(info?.severity).toBe("info");
    expect(result.valid).toBe(true);
  });

  it("can have multiple issues at once", () => {
    const seg = makeSegment({ label: "", criteria: [], personaIds: [] });
    const result = validateSegment(seg);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.valid).toBe(false);
  });
});
