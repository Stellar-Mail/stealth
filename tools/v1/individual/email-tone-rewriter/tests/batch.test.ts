/**
 * Tests for the batch processing service.
 */

import { describe, it, expect } from "vitest";
import {
  processBatch,
  processBatchParallel,
  summarizeBatch,
  successes,
  failures,
  groupByTone,
  averageReduction,
  mostCommonError,
  validateBatch,
  deduplicateDrafts,
  sortByLength,
  sortByLengthDesc,
  applyToneToAll,
  applyMaxWordsToAll,
} from "../services/batch";
import type { RewriteRequest } from "../services/emailToneRewriter";

const VALID_DRAFT: RewriteRequest = {
  subject: "Test",
  bodyText: "Hello, please review this document by Friday.",
  tone: "formal",
};

const ANOTHER_VALID_DRAFT: RewriteRequest = {
  subject: "Update",
  bodyText: "The report is ready for your review.",
  tone: "concise",
};

const EMPTY_DRAFT: RewriteRequest = {
  subject: "",
  bodyText: "",
  tone: "friendly",
};

const INVALID_TONE_DRAFT: RewriteRequest = {
  subject: "Test",
  bodyText: "Hello world.",
  tone: "invalid" as RewriteRequest["tone"],
};

describe("processBatch", () => {
  it("returns empty array for empty input", () => {
    const results = processBatch([]);
    expect(results).toEqual([]);
  });

  it("processes a single valid draft", () => {
    const results = processBatch([VALID_DRAFT]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("success");
  });

  it("processes multiple drafts", () => {
    const results = processBatch([VALID_DRAFT, ANOTHER_VALID_DRAFT]);
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("success");
    expect(results[1].status).toBe("success");
  });

  it("handles errors gracefully", () => {
    const results = processBatch([EMPTY_DRAFT]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("error");
  });

  it("processes mixed valid and invalid drafts", () => {
    const results = processBatch([VALID_DRAFT, EMPTY_DRAFT, ANOTHER_VALID_DRAFT]);
    expect(results).toHaveLength(3);
    expect(results[0].status).toBe("success");
    expect(results[1].status).toBe("error");
    expect(results[2].status).toBe("success");
  });

  it("preserves input order", () => {
    const drafts = [VALID_DRAFT, ANOTHER_VALID_DRAFT];
    const results = processBatch(drafts);
    for (let i = 0; i < results.length; i++) {
      expect(results[i].index).toBe(i);
      expect(results[i].request).toBe(drafts[i]);
    }
  });
});

describe("processBatchParallel", () => {
  it("returns empty array for empty input", () => {
    const results = processBatchParallel([]);
    expect(results).toEqual([]);
  });

  it("processes drafts in parallel batches", () => {
    const drafts = Array(10).fill(VALID_DRAFT);
    const results = processBatchParallel(drafts, 3);
    expect(results).toHaveLength(10);
    for (const result of results) {
      expect(result.status).toBe("success");
    }
  });

  it("handles errors in parallel processing", () => {
    const drafts = [VALID_DRAFT, EMPTY_DRAFT, VALID_DRAFT];
    const results = processBatchParallel(drafts, 2);
    expect(results).toHaveLength(3);
    expect(results[0].status).toBe("success");
    expect(results[1].status).toBe("error");
    expect(results[2].status).toBe("success");
  });
});

describe("summarizeBatch", () => {
  it("summarizes results correctly", () => {
    const results = processBatch([VALID_DRAFT, EMPTY_DRAFT]);
    const summary = summarizeBatch(results, Date.now());
    expect(summary.total).toBe(2);
    expect(summary.successCount).toBe(1);
    expect(summary.errorCount).toBe(1);
    expect(summary.successRate).toBe(50);
  });

  it("handles empty results", () => {
    const summary = summarizeBatch([], Date.now());
    expect(summary.total).toBe(0);
    expect(summary.successRate).toBe(0);
  });

  it("records duration", () => {
    const results = processBatch([VALID_DRAFT]);
    const summary = summarizeBatch(results, Date.now() - 100);
    expect(summary.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("successes", () => {
  it("returns only successful results", () => {
    const results = processBatch([VALID_DRAFT, EMPTY_DRAFT]);
    const good = successes(results);
    expect(good).toHaveLength(1);
    expect(good[0].status).toBe("success");
  });

  it("returns empty array when all fail", () => {
    const results = processBatch([EMPTY_DRAFT]);
    expect(successes(results)).toEqual([]);
  });
});

describe("failures", () => {
  it("returns only failed results", () => {
    const results = processBatch([VALID_DRAFT, EMPTY_DRAFT]);
    const bad = failures(results);
    expect(bad).toHaveLength(1);
    expect(bad[0].status).toBe("error");
  });

  it("returns empty array when all succeed", () => {
    const results = processBatch([VALID_DRAFT]);
    expect(failures(results)).toEqual([]);
  });
});

describe("groupByTone", () => {
  it("groups results by tone", () => {
    const results = processBatch([VALID_DRAFT, ANOTHER_VALID_DRAFT]);
    const groups = groupByTone(results);
    expect(Object.keys(groups)).toContain("formal");
    expect(Object.keys(groups)).toContain("concise");
  });

  it("handles empty results", () => {
    expect(groupByTone([])).toEqual({});
  });
});

describe("averageReduction", () => {
  it("computes average word reduction", () => {
    const results = processBatch([VALID_DRAFT, ANOTHER_VALID_DRAFT]);
    const reduction = averageReduction(results);
    expect(typeof reduction).toBe("number");
  });

  it("returns 0 for empty results", () => {
    expect(averageReduction([])).toBe(0);
  });
});

describe("mostCommonError", () => {
  it("finds the most common error", () => {
    const results = processBatch([EMPTY_DRAFT, EMPTY_DRAFT]);
    const common = mostCommonError(results);
    expect(common).not.toBeNull();
    expect(common!.count).toBeGreaterThan(0);
  });

  it("returns null when no errors", () => {
    const results = processBatch([VALID_DRAFT]);
    expect(mostCommonError(results)).toBeNull();
  });
});

describe("validateBatch", () => {
  it("returns empty map for valid drafts", () => {
    const errors = validateBatch([VALID_DRAFT]);
    expect(errors.size).toBe(0);
  });

  it("detects empty body", () => {
    const errors = validateBatch([EMPTY_DRAFT]);
    expect(errors.has(0)).toBe(true);
    expect(errors.get(0)).toContain("Draft body is required.");
  });

  it("detects missing tone", () => {
    const draft: RewriteRequest = {
      subject: "",
      bodyText: "Hello",
      tone: "" as RewriteRequest["tone"],
    };
    const errors = validateBatch([draft]);
    expect(errors.get(0)).toContain("Tone is required.");
  });

  it("detects oversized subject", () => {
    const draft: RewriteRequest = {
      subject: "x".repeat(201),
      bodyText: "Hello",
      tone: "formal",
    };
    const errors = validateBatch([draft]);
    expect(errors.get(0)).toContain("Subject exceeds 200 characters.");
  });

  it("detects invalid maxWords", () => {
    const draft: RewriteRequest = {
      ...VALID_DRAFT,
      maxWords: -1,
    };
    const errors = validateBatch([draft]);
    const msgs = errors.get(0) || [];
    expect(msgs.some((m) => m.includes("maxWords"))).toBe(true);
  });
});

describe("deduplicateDrafts", () => {
  it("removes duplicates by body text", () => {
    const drafts = [VALID_DRAFT, VALID_DRAFT, ANOTHER_VALID_DRAFT];
    const unique = deduplicateDrafts(drafts);
    expect(unique).toHaveLength(2);
  });

  it("keeps first occurrence of each body", () => {
    const a: RewriteRequest = { ...VALID_DRAFT, subject: "First" };
    const b: RewriteRequest = { ...VALID_DRAFT, subject: "Second" };
    const unique = deduplicateDrafts([a, b]);
    expect(unique).toHaveLength(1);
    expect(unique[0].subject).toBe("First");
  });
});

describe("sortByLength / sortByLengthDesc", () => {
  it("sorts by body length ascending", () => {
    const short: RewriteRequest = { ...VALID_DRAFT, bodyText: "Hi." };
    const long: RewriteRequest = {
      ...VALID_DRAFT,
      bodyText: "Hello, this is a longer draft.",
    };
    const sorted = sortByLength([long, short]);
    expect(sorted[0].bodyText.length).toBeLessThanOrEqual(sorted[1].bodyText.length);
  });

  it("sorts by body length descending", () => {
    const short: RewriteRequest = { ...VALID_DRAFT, bodyText: "Hi." };
    const long: RewriteRequest = {
      ...VALID_DRAFT,
      bodyText: "Hello, this is a longer draft.",
    };
    const sorted = sortByLengthDesc([short, long]);
    expect(sorted[0].bodyText.length).toBeGreaterThanOrEqual(sorted[1].bodyText.length);
  });
});

describe("applyToneToAll", () => {
  it("applies the same tone to all drafts", () => {
    const drafts = [VALID_DRAFT, ANOTHER_VALID_DRAFT];
    const updated = applyToneToAll(drafts, "concise");
    for (const draft of updated) {
      expect(draft.tone).toBe("concise");
    }
  });

  it("does not mutate the input array", () => {
    const drafts = [VALID_DRAFT];
    const originalTone = drafts[0].tone;
    applyToneToAll(drafts, "concise");
    expect(drafts[0].tone).toBe(originalTone);
  });
});

describe("applyMaxWordsToAll", () => {
  it("applies maxWords to all drafts", () => {
    const drafts = [VALID_DRAFT, ANOTHER_VALID_DRAFT];
    const updated = applyMaxWordsToAll(drafts, 50);
    for (const draft of updated) {
      expect(draft.maxWords).toBe(50);
    }
  });

  it("does not mutate the input array", () => {
    const drafts = [VALID_DRAFT];
    applyMaxWordsToAll(drafts, 50);
    expect(drafts[0].maxWords).toBeUndefined();
  });
});
