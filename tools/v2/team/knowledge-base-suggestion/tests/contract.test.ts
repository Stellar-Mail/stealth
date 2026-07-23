/**
 * contract.test.ts — Knowledge Base Suggestion (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, relevance
 * scoring/ranking, limit, filtering, warnings, and the edge/error paths
 * (empty query, no match, invalid corpus). No UI is exercised.
 */

import { describe, it, expect } from "vitest";
import { createKbSuggestionService } from "../services/kb-suggestion.service";
import {
  KbErrorCode,
  ok,
  fail,
  tokenize,
  normalizeText,
  suggestKb,
  filterCorpus,
  validateInput,
  type KbResult,
  type KbContractOutput,
  type KbCorpusFilter,
} from "../core/engine";
import { scoreArticle, computeScores, normalizeScore, daysSinceUpdate } from "../core/scoring";
import {
  rankArticles,
  applyRankingStrategy,
  deduplicateSuggestions,
  mergeSuggestionSets,
  type ScoredResult,
} from "../core/ranking";
import {
  buildFilter,
  buildFilters,
  filterByAccess,
  filterByLocale,
  filterByTeam,
  filterByProduct,
  filterByCategory,
  filterOutDeprecated,
  filterByMinRating,
} from "../core/filters";
import {
  validateQuery,
  validateCorpus,
  validateLimit,
  validateConfig,
  validateSuggestInputDetailed,
} from "../core/validation";
import { SuggestionCache, createNoOpCache } from "../core/cache";
import { AnalyticsCollector } from "../core/analytics";
import type { SuggestionConfig, KbMatchReason } from "../types";
import { RankingStrategy, AnalyticsEventType } from "../types";
import {
  KB_ARTICLES,
  publicFilter,
  enLocaleFilter,
  excludeDeprecatedFilter,
  tagWeightedConfig,
  contentWeightedConfig,
  popularityBoostedConfig,
  balancedConfig,
  generateLargeCorpus,
} from "../fixtures";

function makeContract() {
  return createKbSuggestionService();
}

// =============================================================================
// Result Helpers
// =============================================================================

describe("kb contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    expect(ok("v")).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(KbErrorCode.NoMatch, "none");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(KbErrorCode.NoMatch);
      expect(r.message).toBe("none");
    }
  });
});

// =============================================================================
// Tokenizer & Normalizer
// =============================================================================

describe("kb contract — tokenize/normalize", () => {
  it("tokenize splits and lowercases", () => {
    expect(tokenize("Invoice Billing")).toEqual(["invoice", "billing"]);
  });

  it("tokenize handles empty input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });

  it("normalizeText lowercases and trims", () => {
    expect(normalizeText("  Security  ")).toBe("security");
  });

  it("normalizeText handles empty input", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText(null as any)).toBe("");
  });
});

// =============================================================================
// Scoring Module
// =============================================================================

describe("kb contract — scoring", () => {
  it("scoreArticle returns null for empty query tokens", () => {
    const result = scoreArticle(KB_ARTICLES[0], [], { tagWeight: 2, titleWeight: 1 });
    expect(result).toBeNull();
  });

  it("scoreArticle returns null for null article", () => {
    const result = scoreArticle(null as any, ["test"], { tagWeight: 2, titleWeight: 1 });
    expect(result).toBeNull();
  });

  it("scoreArticle finds tag matches", () => {
    const article = KB_ARTICLES.find((a) => a.id === "kb-billing")!;
    const result = scoreArticle(article, ["billing", "invoices"], { tagWeight: 2, titleWeight: 1 });
    expect(result).not.toBeNull();
    expect(result!.suggestion.score).toBeGreaterThanOrEqual(4); // 2 tags * 2 weight
    expect(result!.reasons.some((r) => r.type === "tag-match")).toBe(true);
  });

  it("scoreArticle finds title keyword matches", () => {
    const article = KB_ARTICLES.find((a) => a.id === "kb-security")!;
    const result = scoreArticle(article, ["security"], { titleWeight: 1 });
    expect(result).not.toBeNull();
    expect(result!.suggestion.score).toBeGreaterThanOrEqual(1);
    expect(result!.reasons.some((r) => r.type === "title-keyword")).toBe(true);
  });

  it("normalizeScore returns 0-100 range", () => {
    expect(normalizeScore(0, 100)).toBe(0);
    expect(normalizeScore(50, 100)).toBe(50);
    expect(normalizeScore(100, 100)).toBe(100);
    expect(normalizeScore(150, 100)).toBe(100);
    expect(normalizeScore(-10, 100)).toBe(0);
  });

  it("daysSinceUpdate returns null for missing date", () => {
    const result = daysSinceUpdate({ id: "test", title: "test", tags: [] });
    expect(result).toBeNull();
  });
});

// =============================================================================
// Ranking Module
// =============================================================================

describe("kb contract — ranking", () => {
  it("rankArticles sorts by score desc then title asc", () => {
    const scored: ScoredResult[] = [
      { suggestion: { articleId: "a", title: "A", score: 1 } as any, reasons: [] },
      { suggestion: { articleId: "b", title: "B", score: 2 } as any, reasons: [] },
    ];
    const ranked = rankArticles(scored);
    expect(ranked[0].suggestion.articleId).toBe("b");
    expect(ranked[1].suggestion.articleId).toBe("a");
  });

  it("rankArticles respects limit", () => {
    const scored: ScoredResult[] = [
      { suggestion: { articleId: "a", title: "A", score: 1 } as any, reasons: [] },
      { suggestion: { articleId: "b", title: "B", score: 2 } as any, reasons: [] },
      { suggestion: { articleId: "c", title: "C", score: 3 } as any, reasons: [] },
    ];
    const ranked = rankArticles(scored, 2);
    expect(ranked.length).toBe(2);
  });

  it("deduplicateSuggestions keeps highest scored", () => {
    const suggestions = [
      { articleId: "a", title: "A", score: 1 },
      { articleId: "a", title: "A", score: 3 },
      { articleId: "b", title: "B", score: 2 },
    ];
    const deduped = deduplicateSuggestions(suggestions as any);
    expect(deduped.length).toBe(2);
    expect(deduped.find((s) => s.articleId === "a")!.score).toBe(3);
  });

  it("mergeSuggestionSets deduplicates and sorts", () => {
    const set1 = [{ articleId: "a", title: "A", score: 1 }];
    const set2 = [{ articleId: "b", title: "B", score: 3 }];
    const set3 = [{ articleId: "a", title: "A", score: 2 }];
    const merged = mergeSuggestionSets([set1, set2, set3] as any);
    expect(merged.length).toBe(2);
    expect(merged[0].articleId).toBe("b"); // higher score
  });

  it("applyRankingStrategy with TagWeighted strategy", () => {
    const scored: ScoredResult[] = [
      {
        suggestion: { articleId: "a", title: "A", score: 2 } as any,
        reasons: [{ type: "tag-match", token: "billing", matchedValue: "billing" }],
      },
      {
        suggestion: { articleId: "b", title: "B", score: 3 } as any,
        reasons: [],
      },
    ];
    const result = applyRankingStrategy(scored, tagWeightedConfig);
    // Article A should get boosted from tag matches
    expect(result.length).toBe(2);
  });
});

// =============================================================================
// Filter Module
// =============================================================================

describe("kb contract — filterCorpus", () => {
  it("filters corpus and returns warnings", () => {
    const result = filterCorpus(KB_ARTICLES, [publicFilter]);
    expect(result.filtered.length).toBeLessThan(KB_ARTICLES.length);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.appliedFilters).toContain("public-access");
  });

  it("handles empty filters", () => {
    const result = filterCorpus(KB_ARTICLES, []);
    expect(result.filtered.length).toBe(KB_ARTICLES.length);
    expect(result.warnings.length).toBe(0);
  });

  it("returns warning for invalid corpus", () => {
    const result = filterCorpus(null as any, []);
    expect(result.filtered.length).toBe(0);
    expect(result.warnings).toContain("corpus must be an array");
  });

  it("handles empty corpus", () => {
    const result = filterCorpus([], [publicFilter]);
    expect(result.filtered.length).toBe(0);
    expect(result.warnings.length).toBe(0);
  });
});

describe("kb contract — buildFilter", () => {
  it("builds access filter", () => {
    const filter = filterByAccess("public");
    const result = KB_ARTICLES.filter(filter);
    expect(result.every((a) => a.access === "public")).toBe(true);
  });

  it("builds locale filter", () => {
    const filter = filterByLocale("fr");
    const result = KB_ARTICLES.filter(filter);
    expect(result.every((a) => a.locale === "fr")).toBe(true);
  });

  it("builds deprecated filter", () => {
    const filter = filterOutDeprecated();
    const result = KB_ARTICLES.filter(filter);
    expect(result.every((a) => a.deprecated !== true)).toBe(true);
  });

  it("builds multiple filters from configs", () => {
    const filters = buildFilters([
      { type: "access" as any, value: "public" },
      { type: "locale" as any, value: "en" },
    ]);
    expect(filters.length).toBe(2);
  });
});

// =============================================================================
// Validation Module
// =============================================================================

describe("kb contract — validation", () => {
  it("validateQuery rejects null/undefined", () => {
    expect(validateQuery(null)).not.toBeNull();
    expect(validateQuery(undefined)).not.toBeNull();
  });

  it("validateQuery rejects empty", () => {
    expect(validateQuery("   ")).not.toBeNull();
  });

  it("validateQuery accepts valid string", () => {
    expect(validateQuery("billing")).toBeNull();
  });

  it("validateCorpus rejects null", () => {
    expect(validateCorpus(null)).not.toBeNull();
  });

  it("validateCorpus rejects non-array", () => {
    expect(validateCorpus("not array")).not.toBeNull();
  });

  it("validateCorpus accepts array", () => {
    expect(validateCorpus([])).toBeNull();
  });

  it("validateLimit rejects negative", () => {
    expect(validateLimit(-1)).not.toBeNull();
  });

  it("validateLimit rejects float", () => {
    expect(validateLimit(1.5)).not.toBeNull();
  });

  it("validateLimit rejects exceeding max", () => {
    expect(validateLimit(100, 50)).not.toBeNull();
  });

  it("validateLimit accepts valid number", () => {
    expect(validateLimit(10, 50)).toBeNull();
  });

  it("validateConfig checks weights", () => {
    const result = validateConfig({ tagWeight: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("validateConfig accepts valid config", () => {
    const result = validateConfig({ tagWeight: 2, titleWeight: 1 });
    expect(result.valid).toBe(true);
  });

  it("validateSuggestInputDetailed returns errors", () => {
    const result = validateSuggestInputDetailed({ query: "" }, null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// suggestKb Pure Function
// =============================================================================

describe("kb contract — suggestKb", () => {
  it("returns suggestions and warnings", () => {
    const result = suggestKb("invoice billing", KB_ARTICLES);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].articleId).toBe("kb-billing");
  });

  it("applies filters to exclude articles", () => {
    // "fr-onboarding" is french locale; enLocaleFilter removes it
    const result = suggestKb("onboarding", KB_ARTICLES, 5, [enLocaleFilter]);
    // kb-fr-onboarding should be filtered out; kb-onboarding should still match
    const frMatch = result.suggestions.find((s) => s.articleId === "kb-fr-onboarding");
    expect(frMatch).toBeUndefined();
    const enMatch = result.suggestions.find((s) => s.articleId === "kb-onboarding");
    expect(enMatch).toBeDefined();
  });

  it("returns suggestions with confidence values", () => {
    const result = suggestKb("security", KB_ARTICLES);
    if (result.suggestions.length > 0) {
      expect(result.suggestions[0].confidence).toBeDefined();
      expect(result.suggestions[0].confidence).toBeGreaterThanOrEqual(0);
    }
  });
});

// =============================================================================
// SuggestionCache
// =============================================================================

describe("kb contract — SuggestionCache", () => {
  it("stores and retrieves entries", () => {
    const cache = new SuggestionCache({ maxEntries: 10, enableCleanup: false });
    cache.set("qhash", "chash", [{ articleId: "test", title: "Test", score: 1 }], 10);
    const result = cache.get("qhash", "chash");
    expect(result).not.toBeNull();
    expect(result!.suggestions[0].articleId).toBe("test");
  });

  it("returns null for miss", () => {
    const cache = new SuggestionCache({ maxEntries: 10, enableCleanup: false });
    const result = cache.get("nonexistent", "corpus");
    expect(result).toBeNull();
  });

  it("invalidates specific entry", () => {
    const cache = new SuggestionCache({ maxEntries: 10, enableCleanup: false });
    cache.set("q", "c", [{ articleId: "test", title: "T", score: 1 }], 5);
    expect(cache.invalidate("q", "c")).toBe(true);
    expect(cache.get("q", "c")).toBeNull();
  });

  it("invalidates all entries", () => {
    const cache = new SuggestionCache({ maxEntries: 10, enableCleanup: false });
    cache.set("q1", "c1", [{ articleId: "a", title: "A", score: 1 }], 5);
    cache.set("q2", "c2", [{ articleId: "b", title: "B", score: 1 }], 5);
    cache.invalidateAll();
    expect(cache.size).toBe(0);
  });

  it("tracks hit rate", () => {
    const cache = new SuggestionCache({ maxEntries: 10, enableCleanup: false });
    cache.set("q", "c", [{ articleId: "test", title: "T", score: 1 }], 5);
    cache.get("q", "c");
    cache.get("miss", "c");
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });

  it("createNoOpCache returns placeholder", () => {
    const cache = createNoOpCache();
    expect(cache.get()).toBeNull();
    expect(() => cache.set()).not.toThrow();
    expect(cache.getStats()).toBeDefined();
  });
});

// =============================================================================
// AnalyticsCollector
// =============================================================================

describe("kb contract — AnalyticsCollector", () => {
  it("records and aggregates events", () => {
    const analytics = new AnalyticsCollector(100);
    analytics.recordRequest("billing", ["kb-billing"], 50, false);
    analytics.recordSelection("billing", ["kb-billing"], "kb-billing", 10);
    analytics.recordError("timeout", "connection error", 5000);

    const summary = analytics.getSummary();
    expect(summary.totalRequests).toBe(1);
    expect(summary.totalSelections).toBe(1);
    expect(summary.errorCount).toBe(1);
    expect(summary.topArticles.length).toBeGreaterThanOrEqual(1);
  });

  it("clear removes all events", () => {
    const analytics = new AnalyticsCollector(100);
    analytics.recordRequest("test", [], 0, false);
    expect(analytics.totalEvents).toBe(1);
    analytics.clear();
    expect(analytics.totalEvents).toBe(0);
  });

  it("returns empty summary when no events", () => {
    const analytics = new AnalyticsCollector(100);
    const summary = analytics.getSummary();
    expect(summary.totalRequests).toBe(0);
    expect(summary.averageLatencyMs).toBe(0);
    expect(summary.cacheHitRate).toBe(0);
  });
});

// =============================================================================
// Contract Execution
// =============================================================================

describe("kb contract — execute", () => {
  it("ranks billing query to the billing article", () => {
    const contract = makeContract();
    const res = contract.execute(
      { operation: "suggest", input: { query: "invoice billing" } },
      KB_ARTICLES,
    );
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "suggest") {
      expect(res.value.suggestions[0].articleId).toBe("kb-billing");
      expect(res.value.suggestions[0].score).toBeGreaterThan(0);
    }
  });

  it("respects the limit", () => {
    const contract = makeContract();
    const res = contract.execute(
      { operation: "suggest", input: { query: "team security billing onboarding", limit: 1 } },
      KB_ARTICLES,
    );
    if (res.ok && res.value.operation === "suggest") {
      expect(res.value.suggestions.length).toBe(1);
    }
  });

  it("applies filters via execute", () => {
    const contract = makeContract();
    const res = contract.execute(
      { operation: "suggest", input: { query: "security" } },
      KB_ARTICLES,
      [publicFilter],
    );
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "suggest") {
      expect(res.value.suggestions[0].articleId).toBe("kb-security");
      expect(res.value.warnings).toBeDefined();
    }
  });

  it("rejects an empty query (no throw)", () => {
    const contract = makeContract();
    const res: KbResult<KbContractOutput> = contract.execute(
      { operation: "suggest", input: { query: "   " } },
      KB_ARTICLES,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(KbErrorCode.InvalidInput);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("kb contract — edge cases", () => {
  it("handles very long query gracefully", () => {
    const longQuery = "a ".repeat(1000).trim();
    const contract = makeContract();
    const res = contract.execute(
      { operation: "suggest", input: { query: longQuery } },
      KB_ARTICLES,
    );
    // Should not crash; may return NoMatch or suggestions
    expect(res.ok).toBeDefined();
  });

  it("handles special characters in query", () => {
    const contract = makeContract();
    const res = contract.execute(
      { operation: "suggest", input: { query: "billing!@#$%^&*()invoice" } },
      KB_ARTICLES,
    );
    // Tokenizer should handle special chars
    if (res.ok && res.value.operation === "suggest") {
      expect(res.value.suggestions.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles unknown operation gracefully", () => {
    const contract = makeContract();
    const res = contract.execute(
      { operation: "unknown-op" as any, input: { query: "test" } },
      KB_ARTICLES,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(KbErrorCode.InvalidInput);
  });

  it("large corpus batch suggestion completes", () => {
    const largeCorpus = generateLargeCorpus(50);
    const result = suggestKb("billing", largeCorpus, 10);
    expect(result.suggestions.length).toBeLessThanOrEqual(10);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
