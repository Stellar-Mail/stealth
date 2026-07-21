/**
 * contract.ts — Knowledge Base Suggestion (non-UI execution contract)
 *
 * Backend-facing execution contract for suggesting internal documentation.
 * It is presentation-free: no React, no DOM. Operations return a typed
 * `KbResult<T>` discriminated union with explicit error codes instead of
 * throwing.
 */

import type { KbArticle, KbSuggestion, SuggestInput } from "./types";

/** Explicit, machine-readable error codes for contract operations. */
export enum KbErrorCode {
  /** The query was missing/empty or the corpus was invalid. */
  InvalidInput = "INVALID_INPUT",
  /** No articles matched the query. */
  NoMatch = "NO_MATCH",
}

/** Discriminated outcome returned by every contract operation. */
export type KbResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: KbErrorCode; message: string };

/** Operations supported by the KB suggestion contract. */
export type KbOperation = { operation: "suggest"; input: SuggestInput };

/** Output produced by the contract, keyed by operation. */
export type KbContractOutput = {
  operation: "suggest";
  suggestions: KbSuggestion[];
};

/** Backend-facing entry point for KB suggestions. */
export interface KbContract {
  execute(input: KbOperation, corpus: KbArticle[]): KbResult<KbContractOutput>;
}

/** Typed success outcome. */
export function ok<T>(value: T): KbResult<T> {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(error: KbErrorCode, message: string): KbResult<T> {
  return { ok: false, error, message };
}

/** Tokenize a query into lowercase alphanumeric terms. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 0);
}

/**
 * Pure relevance scoring. Scores each article by:
 *  - tag overlap with the query tokens (+2 per matched tag)
 *  - title keyword hits (+1 per query token found in the title)
 * Returns suggestions sorted by score desc, capped at `limit`.
 * Deterministic given the same inputs.
 */
export function suggestKb(query: string, corpus: KbArticle[], limit = 5): KbSuggestion[] {
  const terms = tokenize(query);
  const scored: KbSuggestion[] = [];
  for (const article of corpus) {
    let score = 0;
    const titleLower = article.title.toLowerCase();
    for (const term of terms) {
      if (article.tags.some((t) => t.toLowerCase() === term)) score += 2;
      if (titleLower.includes(term)) score += 1;
    }
    if (score > 0) {
      scored.push({
        articleId: article.id,
        title: article.title,
        summary: article.summary,
        score,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored.slice(0, limit);
}

/** Validate inputs before scoring. */
export function validateSuggest(input: SuggestInput, corpus: KbArticle[]): string | null {
  if (!Array.isArray(corpus)) return "corpus must be an array";
  if (!input || typeof input.query !== "string" || input.query.trim().length === 0)
    return "query is required";
  return null;
}
