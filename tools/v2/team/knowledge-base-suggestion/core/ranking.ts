/**
 * ranking.ts — Knowledge Base Suggestion (ranking module)
 *
 * Pure ranking functions for sorting scored articles.
 * Supports multiple ranking strategies and deterministic tie-breaking.
 * No imports from the main app.
 */

import type { KbSuggestion, KbMatchReason, SuggestionConfig } from "../types";
import { RankingStrategy } from "../types";

/**
 * Internal type for scored results with reasons.
 */
export interface ScoredResult {
  suggestion: KbSuggestion;
  reasons: KbMatchReason[];
}

/**
 * Primary sort: score desc, then title asc for tie-breaking.
 * Deterministic given the same inputs.
 *
 * @param scored - Array of scored results to sort
 * @param limit - Maximum number of results to return
 * @returns Sorted and capped suggestions (without reasons)
 */
export function rankArticles(scored: ScoredResult[], limit: number = 5): ScoredResult[] {
  if (!Array.isArray(scored)) return [];
  if (scored.length === 0) return [];

  const sorted = [...scored].sort((a, b) => {
    // Primary: score descending
    const scoreDiff = b.suggestion.score - a.suggestion.score;
    if (scoreDiff !== 0) return scoreDiff;

    // Secondary: title ascending (tie-breaker)
    return a.suggestion.title.localeCompare(b.suggestion.title);
  });

  return sorted.slice(0, Math.max(0, limit));
}

/**
 * Re-rank results using a specific strategy with configurable weights.
 *
 * Strategies:
 *   - Default: standard score desc then title asc
 *   - TagWeighted: emphasize tag overlap scores
 *   - ContentWeighted: emphasize content and title keywords
 *   - PopularityBoosted: add extra weight from popularity
 *   - RecencyBoosted: add extra weight from recency
 *   - Balanced: evenly balance all scoring factors
 *
 * @param scored - Array of scored results
 * @param config - Configuration with strategy and weights
 * @returns Re-ranked results
 */
export function applyRankingStrategy(
  scored: ScoredResult[],
  config: SuggestionConfig,
): ScoredResult[] {
  if (!Array.isArray(scored) || scored.length === 0) return [];
  if (!config.strategy || config.strategy === RankingStrategy.Default) {
    return rankArticles(scored, config.defaultLimit ?? 5);
  }

  const limit = config.defaultLimit ?? 5;
  let reweighted: ScoredResult[];

  switch (config.strategy) {
    case RankingStrategy.TagWeighted: {
      // Emphasize tag matches (double the tag weight)
      reweighted = scored.map((item) => {
        const tagReasons = item.reasons.filter((r) => r.type === "tag-match");
        const bonus = tagReasons.length * (config.tagWeight ?? 2);
        return {
          ...item,
          suggestion: {
            ...item.suggestion,
            score: item.suggestion.score + bonus * 0.5,
          },
        };
      });
      break;
    }

    case RankingStrategy.ContentWeighted: {
      // Emphasize title and content matches
      reweighted = scored.map((item) => {
        const contentReasons = item.reasons.filter(
          (r) => r.type === "title-keyword" || r.type === "content-keyword",
        );
        const bonus = contentReasons.length * (config.contentWeight ?? 0.5);
        return {
          ...item,
          suggestion: {
            ...item.suggestion,
            score: item.suggestion.score + bonus,
          },
        };
      });
      break;
    }

    case RankingStrategy.PopularityBoosted: {
      // Boost articles with popularity bonus reasons
      reweighted = scored.map((item) => {
        const popReasons = item.reasons.filter((r) => r.type === "popularity-bonus");
        const bonus = popReasons.reduce((sum, r) => {
          if (r.type === "popularity-bonus") return sum + r.bonus;
          return sum;
        }, 0);
        return {
          ...item,
          suggestion: {
            ...item.suggestion,
            score: item.suggestion.score + bonus,
          },
        };
      });
      break;
    }

    case RankingStrategy.RecencyBoosted: {
      // Boost articles with recency bonus reasons
      reweighted = scored.map((item) => {
        const recReasons = item.reasons.filter((r) => r.type === "recency-bonus");
        const bonus = recReasons.reduce((sum, r) => {
          if (r.type === "recency-bonus") return sum + r.bonus;
          return sum;
        }, 0);
        return {
          ...item,
          suggestion: {
            ...item.suggestion,
            score: item.suggestion.score + bonus,
          },
        };
      });
      break;
    }

    case RankingStrategy.Balanced: {
      // Balanced scoring: normalize each factor to contribute equally
      reweighted = scored.map((item) => {
        const tagCount = item.reasons.filter((r) => r.type === "tag-match").length;
        const keywordCount = item.reasons.filter(
          (r) => r.type === "title-keyword" || r.type === "content-keyword",
        ).length;
        const popBonus = item.reasons
          .filter(
            (r): r is Extract<KbMatchReason, { type: "popularity-bonus" }> =>
              r.type === "popularity-bonus",
          )
          .reduce((sum, r) => sum + r.bonus, 0);
        const recBonus = item.reasons
          .filter(
            (r): r is Extract<KbMatchReason, { type: "recency-bonus" }> =>
              r.type === "recency-bonus",
          )
          .reduce((sum, r) => sum + r.bonus, 0);

        // Balanced: each factor contributes up to 25% of the score
        const balancedScore =
          tagCount * (config.tagWeight ?? 2) * 0.25 +
          keywordCount * (config.contentWeight ?? 0.5) * 0.25 +
          popBonus * 0.25 +
          recBonus * 0.25 +
          item.suggestion.score * 0.25;

        return {
          ...item,
          suggestion: {
            ...item.suggestion,
            score: balancedScore,
          },
        };
      });
      break;
    }

    default:
      reweighted = scored;
  }

  // Sort by the new score and apply limit
  return rankArticles(reweighted, limit);
}

/**
 * Deduplicate suggestions, keeping the highest-scored version.
 */
export function deduplicateSuggestions(suggestions: KbSuggestion[]): KbSuggestion[] {
  const seen = new Map<string, KbSuggestion>();
  for (const s of suggestions) {
    const existing = seen.get(s.articleId);
    if (!existing || s.score > existing.score) {
      seen.set(s.articleId, s);
    }
  }
  return Array.from(seen.values()).sort(
    (a, b) => b.score - a.score || a.title.localeCompare(b.title),
  );
}

/**
 * Merge multiple suggestion arrays, deduplicating and re-sorting.
 */
export function mergeSuggestionSets(sets: KbSuggestion[][], limit: number = 10): KbSuggestion[] {
  const all = sets.flat();
  const deduplicated = deduplicateSuggestions(all);
  return deduplicated.slice(0, Math.max(0, limit));
}
