/**
 * engine.ts — Knowledge Base Suggestion (modular core engine)
 *
 * Expandable, presentation-free core logic. All ranking, filtering, and
 * validation lives here. No imports from the main app.
 */

import type {
  KbArticle,
  KbSuggestion,
  SuggestInput,
  KbMatchReason,
  SuggestionConfig,
  KbServiceConfig,
} from "../types";
import { RankingStrategy, DEFAULT_SUGGESTION_CONFIG } from "../types";
import { scoreArticle, computeScores, normalizeScore } from "./scoring";
import { rankArticles, applyRankingStrategy, type ScoredResult } from "./ranking";
import { filterCorpus } from "./filters";
import { validateInput } from "./validation";
import { SuggestionCache } from "./cache";
import { AnalyticsCollector } from "./analytics";

/** Explicit, machine-readable error codes for contract operations. */
export enum KbErrorCode {
  InvalidInput = "INVALID_INPUT",
  NoMatch = "NO_MATCH",
  CorpusTooLarge = "CORPUS_TOO_LARGE",
  OperationNotSupported = "OPERATION_NOT_SUPPORTED",
  ServiceUnavailable = "SERVICE_UNAVAILABLE",
}

/** A filter function applied to the corpus. */
export interface KbCorpusFilter {
  name: string;
  (article: KbArticle): boolean;
}

/** Result of corpus filtering with warnings. */
export interface KbCorpusFilterResult {
  filtered: KbArticle[];
  warnings: string[];
  appliedFilters: string[];
}

/** Discriminated outcome returned by every operation. */
export type KbResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: KbErrorCode; message: string };

/** Operations supported by the contract. */
export type KbOperation = { operation: "suggest"; input: SuggestInput };

/** Output produced by the contract. */
export type KbContractOutput = {
  operation: "suggest";
  suggestions: KbSuggestion[];
  warnings?: string[];
  reasons?: KbMatchReason[][];
};

/** Backend-facing entry point for KB suggestions. */
export interface KbContract {
  execute(
    input: KbOperation,
    corpus: KbArticle[],
    filters?: KbCorpusFilter[],
  ): KbResult<KbContractOutput>;
}

/** Typed success outcome. */
export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(
  error: KbErrorCode,
  message: string,
): { ok: false; error: KbErrorCode; message: string } {
  return { ok: false, error, message };
}

/** Tokenize a query into lowercase alphanumeric terms. */
export function tokenize(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 0);
}

/** Normalize text for comparison (lowercase, trimmed). */
export function normalizeText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text.toLowerCase().trim();
}

/**
 * Compute a simple hash for a corpus for cache invalidation.
 */
export function hashCorpus(corpus: KbArticle[]): string {
  if (!Array.isArray(corpus)) return "";
  let hash = 0;
  for (const article of corpus) {
    for (let i = 0; i < article.id.length; i++) {
      const char = article.id.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    if (article.revision) {
      for (let i = 0; i < article.revision.length; i++) {
        const char = article.revision.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
    }
  }
  return hash.toString(16);
}

/**
 * Compute a simple hash for a query string for cache lookup.
 */
export function hashQuery(query: string): string {
  const tokens = tokenize(query);
  return tokens.sort().join(",");
}

/**
 * Pure suggestion reducer. Deterministic given the same inputs.
 * Orchestrates the full pipeline: filter -> score -> rank.
 */
export function suggestKb(
  query: string,
  corpus: KbArticle[],
  limit?: number,
  filters: KbCorpusFilter[] = [],
  config?: Partial<SuggestionConfig>,
): { suggestions: KbSuggestion[]; warnings: string[]; reasons?: KbMatchReason[][] } {
  const mergedConfig: SuggestionConfig = { ...DEFAULT_SUGGESTION_CONFIG, ...config };
  const effectiveLimit = limit ?? mergedConfig.defaultLimit ?? 5;
  const clampedLimit = Math.min(effectiveLimit, mergedConfig.maxLimit ?? 50);

  const terms = tokenize(query);
  if (terms.length === 0) {
    return {
      suggestions: [],
      warnings: ["query produced no tokens; empty or invalid query"],
    };
  }

  const filterResult = filterCorpus(corpus, filters);
  const workingCorpus = filterResult.filtered;

  if (workingCorpus.length === 0) {
    return {
      suggestions: [],
      warnings: [...filterResult.warnings, "no articles remain after filtering"],
    };
  }

  const scored = workingCorpus
    .map((article) => scoreArticle(article, terms, mergedConfig))
    .filter((result): result is NonNullable<typeof result> => result !== null);

  if (scored.length === 0) {
    return {
      suggestions: [],
      warnings: [...filterResult.warnings, "no articles matched the query"],
    };
  }

  const ranked =
    mergedConfig.strategy && mergedConfig.strategy !== RankingStrategy.Default
      ? applyRankingStrategy(scored, mergedConfig)
      : rankArticles(scored, clampedLimit);

  const maxScore = ranked.length > 0 ? Math.max(...ranked.map((s) => s.suggestion.score)) : 1;
  const suggestions = ranked.map((s) => ({
    ...s.suggestion,
    confidence: normalizeScore(s.suggestion.score, maxScore, 0),
  }));

  const reasons = mergedConfig.includeReasons
    ? scored
        .filter((s) => suggestions.some((r) => r.articleId === s.suggestion.articleId))
        .map((s) => s.reasons)
    : undefined;

  return {
    suggestions,
    warnings: filterResult.warnings,
    reasons,
  };
}

// Re-export modules
export { scoreArticle, computeScores, normalizeScore } from "./scoring";
export { rankArticles, applyRankingStrategy } from "./ranking";
export { filterCorpus } from "./filters";
export { validateInput } from "./validation";
export { SuggestionCache } from "./cache";
export { AnalyticsCollector } from "./analytics";
