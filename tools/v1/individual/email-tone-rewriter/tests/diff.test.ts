/**
 * Tests for the word-level diff engine.
 */

import { describe, it, expect } from "vitest";
import {
  tokenize,
  buildLCSTable,
  backtrack,
  computeDiff,
  summarizeDiff,
  changesOnly,
  renderDiff,
  mergeAdjacent,
  changeRate,
} from "../services/diff";

describe("tokenize", () => {
  it("splits text into words", () => {
    expect(tokenize("hello world")).toEqual(["hello", "world"]);
  });

  it("normalizes whitespace", () => {
    expect(tokenize("hello   world")).toEqual(["hello", "world"]);
  });

  it("trims leading and trailing whitespace", () => {
    expect(tokenize("  hello world  ")).toEqual(["hello", "world"]);
  });

  it("returns empty array for empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(tokenize("   ")).toEqual([]);
  });

  it("handles single word", () => {
    expect(tokenize("hello")).toEqual(["hello"]);
  });

  it("normalizes NFC unicode", () => {
    const composed = "\u00E9"; // é composed
    const decomposed = "\u0065\u0301"; // e + combining accent
    expect(tokenize(composed)).toEqual(tokenize(decomposed));
  });
});

describe("buildLCSTable", () => {
  it("returns zero table for empty arrays", () => {
    const table = buildLCSTable([], []);
    expect(table).toEqual([[0]]);
  });

  it("returns zero table when one array is empty", () => {
    const table = buildLCSTable(["a"], []);
    expect(table).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it("computes LCS for identical arrays", () => {
    const table = buildLCSTable(["a", "b", "c"], ["a", "b", "c"]);
    expect(table[3][3]).toBe(3);
  });

  it("computes LCS for completely different arrays", () => {
    const table = buildLCSTable(["a", "b"], ["c", "d"]);
    expect(table[2][2]).toBe(0);
  });

  it("computes LCS for partially overlapping arrays", () => {
    const table = buildLCSTable(["a", "b", "c"], ["a", "d", "c"]);
    expect(table[3][3]).toBe(2);
  });
});

describe("backtrack", () => {
  it("produces unchanged segments for identical arrays", () => {
    const a = ["hello", "world"];
    const dp = buildLCSTable(a, a);
    const segments = backtrack(a, a, dp);
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("unchanged");
  });

  it("produces added segments when words are inserted", () => {
    const a = ["hello"];
    const b = ["hello", "world"];
    const dp = buildLCSTable(a, b);
    const segments = backtrack(a, b, dp);
    expect(segments.some((s) => s.type === "added")).toBe(true);
  });

  it("produces removed segments when words are deleted", () => {
    const a = ["hello", "world"];
    const b = ["hello"];
    const dp = buildLCSTable(a, b);
    const segments = backtrack(a, b, dp);
    expect(segments.some((s) => s.type === "removed")).toBe(true);
  });
});

describe("computeDiff", () => {
  it("returns empty array for two empty strings", () => {
    expect(computeDiff("", "")).toEqual([]);
  });

  it("returns added segment when original is empty", () => {
    const segments = computeDiff("", "hello world");
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("added");
  });

  it("returns removed segment when rewritten is empty", () => {
    const segments = computeDiff("hello world", "");
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("removed");
  });

  it("returns unchanged for identical text", () => {
    const segments = computeDiff("hello world", "hello world");
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("unchanged");
  });

  it("detects word additions", () => {
    const segments = computeDiff("hello", "hello world");
    const added = segments.filter((s) => s.type === "added");
    expect(added.length).toBeGreaterThan(0);
  });

  it("detects word removals", () => {
    const segments = computeDiff("hello world", "hello");
    const removed = segments.filter((s) => s.type === "removed");
    expect(removed.length).toBeGreaterThan(0);
  });

  it("detects word replacements", () => {
    const segments = computeDiff("hello world", "hi world");
    const added = segments.filter((s) => s.type === "added");
    const removed = segments.filter((s) => s.type === "removed");
    expect(added.length).toBeGreaterThan(0);
    expect(removed.length).toBeGreaterThan(0);
  });

  it("handles longer text with multiple changes", () => {
    const original = "Hey Sam, can you send the Q3 invoice by Friday?";
    const rewritten = "Hello Sam, could you please send the Q3 invoice by Friday?";
    const segments = computeDiff(original, rewritten);
    expect(segments.length).toBeGreaterThan(0);
    const hasAdded = segments.some((s) => s.type === "added");
    const hasRemoved = segments.some((s) => s.type === "removed");
    expect(hasAdded || hasRemoved).toBe(true);
  });
});

describe("summarizeDiff", () => {
  it("returns zero summary for empty diff", () => {
    const summary = summarizeDiff([]);
    expect(summary).toContain("0 words added");
  });

  it("reports word counts correctly", () => {
    const segments = computeDiff("hello world", "hi world");
    const summary = summarizeDiff(segments);
    expect(summary).toContain("added");
    expect(summary).toContain("removed");
    expect(summary).toContain("unchanged");
  });
});

describe("changesOnly", () => {
  it("filters out unchanged segments", () => {
    const segments = computeDiff("hello world", "hi world");
    const changed = changesOnly(segments);
    for (const seg of changed) {
      expect(seg.type).not.toBe("unchanged");
    }
  });

  it("returns empty array when nothing changed", () => {
    const segments = computeDiff("hello", "hello");
    expect(changesOnly(segments)).toEqual([]);
  });
});

describe("renderDiff", () => {
  it("renders unchanged text as-is", () => {
    const segments = computeDiff("hello", "hello");
    const rendered = renderDiff(segments);
    expect(rendered).toBe("hello");
  });

  it("wraps added text in [+ +]", () => {
    const segments = computeDiff("hello", "hello world");
    const rendered = renderDiff(segments);
    expect(rendered).toContain("[+");
    expect(rendered).toContain("+]");
  });

  it("wraps removed text in [- -]", () => {
    const segments = computeDiff("hello world", "hello");
    const rendered = renderDiff(segments);
    expect(rendered).toContain("[-");
    expect(rendered).toContain("-]");
  });
});

describe("mergeAdjacent", () => {
  it("merges consecutive same-type segments", () => {
    const segments: import("../services/diff").DiffSegment[] = [
      { type: "added", text: "hello" },
      { type: "added", text: "world" },
    ];
    const merged = mergeAdjacent(segments);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe("hello world");
  });

  it("does not merge different-type segments", () => {
    const segments: import("../services/diff").DiffSegment[] = [
      { type: "added", text: "hello" },
      { type: "removed", text: "world" },
    ];
    const merged = mergeAdjacent(segments);
    expect(merged).toHaveLength(2);
  });
});

describe("changeRate", () => {
  it("returns 0 for identical text", () => {
    expect(changeRate("hello world", "hello world")).toBe(0);
  });

  it("returns 1 for completely different text", () => {
    expect(changeRate("hello world", "goodbye moon")).toBe(1);
  });

  it("returns a value between 0 and 1 for partial changes", () => {
    const rate = changeRate("hello world", "hello there");
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
  });

  it("returns 0 when both strings are empty", () => {
    expect(changeRate("", "")).toBe(0);
  });
});
