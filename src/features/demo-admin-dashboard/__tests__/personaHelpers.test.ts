import { describe, it, expect } from "vitest";
import {
  filterPersonas,
  isPersonaAssigned,
  assignPersonaToSegment,
  removePersonaFromSegment,
  getPersonasForSegment,
} from "../utils/personaHelpers";
import { defaultPersonas } from "../fixtures/personaFixtures";
import { defaultAudienceSegments } from "../fixtures/audienceSegmentFixtures";
import type { EditableSegment } from "../types/segmentEditorState";

function makeSegment(personaIds: string[] = []): EditableSegment {
  return { ...defaultAudienceSegments[0], personaIds };
}

describe("filterPersonas", () => {
  it("returns all personas when query is empty", () => {
    expect(filterPersonas(defaultPersonas, "")).toHaveLength(defaultPersonas.length);
  });

  it("filters by name (case-insensitive)", () => {
    const result = filterPersonas(defaultPersonas, "amara");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Amara Osei");
  });

  it("filters by email", () => {
    const result = filterPersonas(defaultPersonas, "lena.kovacs");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("persona-02");
  });

  it("returns empty array when no match", () => {
    expect(filterPersonas(defaultPersonas, "zzzznotfound")).toHaveLength(0);
  });

  it("trims the query before filtering", () => {
    const result = filterPersonas(defaultPersonas, "  amara  ");
    expect(result).toHaveLength(1);
  });
});

describe("isPersonaAssigned", () => {
  it("returns true when persona is in personaIds", () => {
    const segment = makeSegment(["persona-01"]);
    expect(isPersonaAssigned(segment, "persona-01")).toBe(true);
  });

  it("returns false when persona is not in personaIds", () => {
    const segment = makeSegment(["persona-02"]);
    expect(isPersonaAssigned(segment, "persona-01")).toBe(false);
  });
});

describe("assignPersonaToSegment", () => {
  it("adds a persona ID", () => {
    const segment = makeSegment([]);
    const updated = assignPersonaToSegment(segment, "persona-01");
    expect(updated.personaIds).toContain("persona-01");
  });

  it("is idempotent — does not duplicate", () => {
    const segment = makeSegment(["persona-01"]);
    const updated = assignPersonaToSegment(segment, "persona-01");
    expect(updated.personaIds.filter((id) => id === "persona-01")).toHaveLength(1);
    expect(updated).toBe(segment);
  });
});

describe("removePersonaFromSegment", () => {
  it("removes the specified persona ID", () => {
    const segment = makeSegment(["persona-01", "persona-02"]);
    const updated = removePersonaFromSegment(segment, "persona-01");
    expect(updated.personaIds).not.toContain("persona-01");
    expect(updated.personaIds).toContain("persona-02");
  });

  it("is a no-op when persona is not assigned", () => {
    const segment = makeSegment(["persona-02"]);
    const updated = removePersonaFromSegment(segment, "persona-99");
    expect(updated.personaIds).toEqual(["persona-02"]);
  });
});

describe("getPersonasForSegment", () => {
  it("returns the Persona objects for all assigned IDs", () => {
    const segment = makeSegment(["persona-01", "persona-03"]);
    const result = getPersonasForSegment(segment, defaultPersonas);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(["persona-01", "persona-03"]);
  });

  it("skips IDs not found in the pool", () => {
    const segment = makeSegment(["persona-01", "persona-99"]);
    const result = getPersonasForSegment(segment, defaultPersonas);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("persona-01");
  });

  it("returns empty array for segment with no personas", () => {
    const segment = makeSegment([]);
    expect(getPersonasForSegment(segment, defaultPersonas)).toHaveLength(0);
  });
});
