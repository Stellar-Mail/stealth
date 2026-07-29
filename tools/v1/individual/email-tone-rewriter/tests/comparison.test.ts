/**
 * Tests for the multi-tone comparison service.
 */

import { describe, it, expect } from "vitest";
import {
  compareAllTones,
  compareTones,
  compareTwoTones,
  findShortestTone,
  findLongestTone,
  wordCountRange,
  findMostPreservingTone,
  wordCountMatrix,
  mostConsistentTone,
  rankTonesByLength,
  findMostSimilarTone,
} from "../services/comparison";
import type { RewriteRequest } from "../services/emailToneRewriter";

const VALID_DRAFT: RewriteRequest = {
  subject: "Test",
  bodyText: "Hello, please review this document by Friday.",
  tone: "formal",
};

const EMPTY_DRAFT: RewriteRequest = {
  subject: "",
  bodyText: "",
  tone: "friendly",
};

describe("compareAllTones", () => {
  it("returns results for all supported tones", () => {
    const comparison = compareAllTones(VALID_DRAFT);
    expect(comparison.results.length).toBeGreaterThanOrEqual(4);
    expect(comparison.successCount).toBeGreaterThan(0);
  });

  it("includes the original draft", () => {
    const comparison = compareAllTones(VALID_DRAFT);
    expect(comparison.original).toBe(VALID_DRAFT);
  });

  it("identifies the shortest and longest tones", () => {
    const comparison = compareAllTones(VALID_DRAFT);
    expect(comparison.shortestTone).toBeTruthy();
    expect(comparison.longestTone).toBeTruthy();
  });

  it("handles empty drafts gracefully", () => {
    const comparison = compareAllTones(EMPTY_DRAFT);
    expect(comparison.errorCount).toBeGreaterThan(0);
  });

  it("each result has the correct shape", () => {
    const comparison = compareAllTones(VALID_DRAFT);
    for (const result of comparison.results) {
      expect(result.tone).toBeTruthy();
      expect(typeof result.wordCount).toBe("number");
      expect(typeof result.changed).toBe("boolean");
      expect(typeof result.truncated).toBe("boolean");
    }
  });
});

describe("compareTones", () => {
  it("returns results for specified tones only", () => {
    const comparison = compareTones(VALID_DRAFT, ["formal", "concise"]);
    expect(comparison.results).toHaveLength(2);
    expect(comparison.results[0].tone).toBe("formal");
    expect(comparison.results[1].tone).toBe("concise");
  });

  it("handles a single tone", () => {
    const comparison = compareTones(VALID_DRAFT, ["friendly"]);
    expect(comparison.results).toHaveLength(1);
  });

  it("handles empty tones array", () => {
    const comparison = compareTones(VALID_DRAFT, []);
    expect(comparison.results).toHaveLength(0);
  });
});

describe("compareTwoTones", () => {
  it("compares two specific tones", () => {
    const result = compareTwoTones(VALID_DRAFT, "formal", "concise");
    expect(result.a.tone).toBe("formal");
    expect(result.b.tone).toBe("concise");
    expect(typeof result.wordDifference).toBe("number");
    expect(typeof result.sameLength).toBe("boolean");
  });

  it("reports whether both changed", () => {
    const result = compareTwoTones(VALID_DRAFT, "formal", "concise");
    expect(typeof result.bothChanged).toBe("boolean");
  });

  it("reports whether both truncated", () => {
    const result = compareTwoTones(VALID_DRAFT, "formal", "concise");
    expect(typeof result.bothTruncated).toBe("boolean");
  });
});

describe("findShortestTone", () => {
  it("returns a tone id", () => {
    const tone = findShortestTone(VALID_DRAFT);
    expect(tone).toBeTruthy();
    expect(["concise", "friendly", "formal", "apologetic"]).toContain(tone);
  });

  it("returns null for empty draft", () => {
    const tone = findShortestTone(EMPTY_DRAFT);
    expect(tone).toBeNull();
  });
});

describe("findLongestTone", () => {
  it("returns a tone id", () => {
    const tone = findLongestTone(VALID_DRAFT);
    expect(tone).toBeTruthy();
    expect(["concise", "friendly", "formal", "apologetic"]).toContain(tone);
  });

  it("returns null for empty draft", () => {
    const tone = findLongestTone(EMPTY_DRAFT);
    expect(tone).toBeNull();
  });
});

describe("wordCountRange", () => {
  it("returns min, max, and range", () => {
    const range = wordCountRange(VALID_DRAFT);
    expect(range.min).toBeGreaterThanOrEqual(0);
    expect(range.max).toBeGreaterThanOrEqual(range.min);
    expect(range.range).toBe(range.max - range.min);
  });

  it("returns zeros for empty draft", () => {
    const range = wordCountRange(EMPTY_DRAFT);
    expect(range.min).toBe(0);
    expect(range.max).toBe(0);
    expect(range.range).toBe(0);
  });
});

describe("findMostPreservingTone", () => {
  it("returns a tone id", () => {
    const tone = findMostPreservingTone(VALID_DRAFT);
    expect(tone).toBeTruthy();
  });

  it("returns null for empty draft", () => {
    const tone = findMostPreservingTone(EMPTY_DRAFT);
    expect(tone).toBeNull();
  });
});

describe("wordCountMatrix", () => {
  it("returns a matrix for multiple drafts", () => {
    const matrix = wordCountMatrix([VALID_DRAFT, VALID_DRAFT]);
    expect(matrix).toHaveLength(2);
    for (const row of matrix) {
      expect(row.draft).toBeDefined();
      expect(Object.keys(row.counts).length).toBeGreaterThanOrEqual(4);
    }
  });

  it("handles empty drafts array", () => {
    expect(wordCountMatrix([])).toEqual([]);
  });
});

describe("mostConsistentTone", () => {
  it("returns a tone for multiple drafts", () => {
    const tone = mostConsistentTone([VALID_DRAFT, VALID_DRAFT]);
    expect(tone).toBeTruthy();
  });

  it("returns null for single draft", () => {
    const tone = mostConsistentTone([VALID_DRAFT]);
    expect(tone).toBeNull();
  });

  it("returns null for empty array", () => {
    const tone = mostConsistentTone([]);
    expect(tone).toBeNull();
  });
});

describe("rankTonesByLength", () => {
  it("returns ranked tones", () => {
    const ranks = rankTonesByLength(VALID_DRAFT);
    expect(ranks.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i].wordCount).toBeGreaterThanOrEqual(ranks[i - 1].wordCount);
    }
  });

  it("each rank has the correct shape", () => {
    const ranks = rankTonesByLength(VALID_DRAFT);
    for (const rank of ranks) {
      expect(rank.tone).toBeTruthy();
      expect(rank.rank).toBeGreaterThan(0);
      expect(rank.wordCount).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("findMostSimilarTone", () => {
  it("returns a tone id", () => {
    const tone = findMostSimilarTone(VALID_DRAFT);
    expect(tone).toBeTruthy();
  });

  it("returns null for empty draft", () => {
    const tone = findMostSimilarTone(EMPTY_DRAFT);
    expect(tone).toBeNull();
  });
});
