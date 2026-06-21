import { describe, it, expect } from "vitest";
import { getSegmentById, resolveSegmentLabel, getSegmentToken } from "../utils/segmentHelpers";
import {
  defaultAudienceSegments,
  AUDIENCE_SEGMENTS_BY_ID,
  audienceSegmentSnapshots,
} from "../fixtures/audienceSegmentFixtures";
import { AUDIENCE_SEGMENT_TOKENS } from "../constants/displayTokens";
import type { AudienceSegmentId } from "../types/audienceSegment";

const ALL_SEGMENT_IDS: AudienceSegmentId[] = [
  "investors",
  "founders",
  "events",
  "relay-operators",
  "unknown-senders",
];

describe("getSegmentById", () => {
  it.each(ALL_SEGMENT_IDS)("returns correct segment for id: %s", (id) => {
    const segment = getSegmentById(id);
    expect(segment).toBeDefined();
    expect(segment?.id).toBe(id);
  });

  it("returns undefined for an unknown id", () => {
    expect(getSegmentById("not-a-segment")).toBeUndefined();
  });
});

describe("resolveSegmentLabel", () => {
  it("returns the display label for a known segment id", () => {
    expect(resolveSegmentLabel("investors")).toBe("Investors");
    expect(resolveSegmentLabel("relay-operators")).toBe("Relay Operators");
    expect(resolveSegmentLabel("unknown-senders")).toBe("Unknown Senders");
  });

  it("returns the raw string for an unknown id without throwing", () => {
    expect(resolveSegmentLabel("some-unknown-id")).toBe("some-unknown-id");
  });
});

describe("getSegmentToken", () => {
  it.each(ALL_SEGMENT_IDS)("returns a non-default DisplayToken for id: %s", (id) => {
    const token = getSegmentToken(id);
    const defaultToken = {
      bg: "bg-purple-500/10",
      text: "text-purple-400",
      border: "border-purple-500/20",
    };
    expect(token.bg).not.toBe(defaultToken.bg);
    expect(token.text).not.toBe(defaultToken.text);
  });

  it("returns a token with the correct label for known ids", () => {
    expect(getSegmentToken("investors").label).toBe("Investors");
    expect(getSegmentToken("founders").label).toBe("Founders");
  });
});

describe("defaultAudienceSegments fixture", () => {
  it("has exactly 5 entries", () => {
    expect(defaultAudienceSegments).toHaveLength(5);
  });

  it("every entry has a matching key in AUDIENCE_SEGMENTS_BY_ID", () => {
    for (const segment of defaultAudienceSegments) {
      expect(AUDIENCE_SEGMENTS_BY_ID[segment.id]).toBeDefined();
      expect(AUDIENCE_SEGMENTS_BY_ID[segment.id].id).toBe(segment.id);
    }
  });

  it("every entry has non-empty label, description, icon, and criteria", () => {
    for (const segment of defaultAudienceSegments) {
      expect(segment.label.length).toBeGreaterThan(0);
      expect(segment.description.length).toBeGreaterThan(0);
      expect(segment.icon.length).toBeGreaterThan(0);
      expect(segment.criteria.length).toBeGreaterThan(0);
    }
  });

  it("every entry has a positive estimatedSize", () => {
    for (const segment of defaultAudienceSegments) {
      expect(segment.estimatedSize).toBeGreaterThan(0);
    }
  });
});

describe("audienceSegmentSnapshots fixture", () => {
  it("has exactly 5 entries", () => {
    expect(audienceSegmentSnapshots).toHaveLength(5);
  });

  it("every snapshot has a unique id", () => {
    const ids = audienceSegmentSnapshots.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every snapshot targetAudience matches a known AudienceSegmentId", () => {
    for (const snap of audienceSegmentSnapshots) {
      expect(ALL_SEGMENT_IDS).toContain(snap.targetAudience as AudienceSegmentId);
    }
  });

  it("all snapshot ids are distinct from defaultCampaignSnapshots ids", () => {
    const newIds = new Set(audienceSegmentSnapshots.map((s) => s.id));
    const existingIds = ["snap-welcome", "snap-security", "snap-newsletter"];
    for (const id of existingIds) {
      expect(newIds.has(id)).toBe(false);
    }
  });
});

describe("AUDIENCE_SEGMENT_TOKENS", () => {
  it("covers all five segment ids", () => {
    for (const id of ALL_SEGMENT_IDS) {
      expect(AUDIENCE_SEGMENT_TOKENS[id]).toBeDefined();
    }
  });
});
