/**
 * scoring.ts — Knowledge Base Suggestion (scoring module)
 *
 * Pure scoring functions for article relevance matching.
 * Supports tag overlap, title keywords, content keywords, category matching,
 * popularity bonus, and recency bonus. No imports from the main app.
 */

import type { KbArticle, KbSuggestion, KbMatchReason, SuggestionConfig } from "../types";

/**
 * Compute the age of an article in days from its updatedAt field.
 */
export function daysSinceUpdate(article: KbArticle): number | null {
  if (!article.updatedAt) return null;
  const updated = new Date(article.updatedAt).getTime();
  if (isNaN(updated)) return null;
  return (Date.now() - updated) / (1000 * 60 * 60 * 24);
}

/**
 * Normalize a raw score to a 0-100 confidence scale.
 */
export function normalizeScore(score: number, maxScore: number, minScore: number = 0): number {
  if (maxScore <= minScore) return 0;
  const raw = ((score - minScore) / (maxScore - minScore)) * 100;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

/**
 * Check if content contains a keyword and return a snippet.
 */
function findContentSnippet(
  content: string,
  token: string,
  contextChars: number = 40,
): string | null {
  const lowerContent = content.toLowerCase();
  const lowerToken = token.toLowerCase();
  const idx = lowerContent.indexOf(lowerToken);
  if (idx === -1) return null;
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(content.length, idx + lowerToken.length + contextChars);
  const snippet =
    (start > 0 ? "..." : "") + content.slice(start, end) + (end < content.length ? "..." : "");
  return snippet;
}

/**
 * Compute a popularity bonus score based on view count.
 */
function computePopularityBonus(
  article: KbArticle,
  maxViewCount: number,
  weight: number,
): { bonus: number; reason: string } | null {
  if (!article.viewCount || article.viewCount <= 0 || maxViewCount <= 0) return null;
  const normalizedBonus = (article.viewCount / maxViewCount) * weight;
  if (normalizedBonus <= 0) return null;
  return {
    bonus: normalizedBonus,
    reason: `article has ${article.viewCount} views`,
  };
}

/**
 * Compute a recency bonus based on how recently the article was updated.
 */
function computeRecencyBonus(
  article: KbArticle,
  weight: number,
): { bonus: number; reason: string } | null {
  const days = daysSinceUpdate(article);
  if (days === null || days < 0) return null;
  // Articles updated within the last 7 days get full bonus, decaying logarithmically
  if (days <= 7) {
    return {
      bonus: weight,
      reason: "updated within the last week",
    };
  }
  const decayedBonus = weight / Math.log2(days / 7 + 1);
  if (decayedBonus <= 0.01) return null;
  return {
    bonus: decayedBonus,
    reason: `updated ${Math.round(days)} days ago`,
  };
}

/**
 * Score a single article against query tokens using the given configuration.
 * Returns the suggestion and match reasons, or null if no match.
 *
 * Scoring factors (configurable via SuggestionConfig):
 *   - Tag overlap: +tagWeight per matched tag
 *   - Title keywords: +titleWeight per matching token in title
 *   - Content keywords: +contentWeight per matching token in content
 *   - Category match: +categoryWeight if query token matches article category
 *   - Popularity bonus: +popularityWeight * normalized view count
 *   - Recency bonus: +recencyWeight * decay factor based on days since update
 *
 * @param article - The article to score
 * @param queryTokens - Tokenized query terms
 * @param config - Scoring configuration with weights
 * @returns Object with suggestion, reasons, and score, or null if no match
 */
export function scoreArticle(
  article: KbArticle,
  queryTokens: string[],
  config: SuggestionConfig,
): { suggestion: KbSuggestion; reasons: KbMatchReason[] } | null {
  if (!article || !queryTokens || queryTokens.length === 0) return null;

  let score = 0;
  const reasons: KbMatchReason[] = [];
  const titleLower = article.title.toLowerCase();
  const contentLower = article.content?.toLowerCase() ?? "";
  const categoryLower = article.category?.toLowerCase() ?? "";
  const tagWeights: Record<string, number> = {};

  // Build tag weight map from keyword frequencies if available
  if (article.keywordFrequencies) {
    for (const [keyword, freq] of Object.entries(article.keywordFrequencies)) {
      tagWeights[keyword.toLowerCase()] = freq;
    }
  }

  for (const term of queryTokens) {
    // 1. Tag overlap scoring
    const matchedTag = article.tags.find((t) => t.toLowerCase() === term);
    if (matchedTag) {
      const weight = config.tagWeight ?? 2;
      // Bonus if the tag has a high frequency in the article
      const freqBonus = tagWeights[term] ? Math.min(tagWeights[term] / 10, 1) : 0;
      const termScore = weight + freqBonus;
      score += termScore;
      reasons.push({
        type: "tag-match",
        token: term,
        matchedValue: matchedTag,
      });
    }

    // 2. Title keyword scoring
    if (titleLower.includes(term)) {
      const weight = config.titleWeight ?? 1;
      score += weight;
      reasons.push({
        type: "title-keyword",
        token: term,
        matchedValue: article.title,
      });
    }

    // 3. Content keyword scoring
    if (config.contentWeight && contentLower.includes(term)) {
      const snippet = findContentSnippet(article.content ?? "", term);
      score += config.contentWeight;
      reasons.push({
        type: "content-keyword",
        token: term,
        snippet: snippet ?? `found in content`,
      });
    }

    // 4. Category match scoring
    if (config.categoryWeight && categoryLower.includes(term)) {
      score += config.categoryWeight;
      reasons.push({
        type: "category-match",
        token: term,
        matchedValue: article.category ?? "",
      });
    }
  }

  // 5. Popularity bonus
  if (config.popularityWeight && article.viewCount && article.viewCount > 0) {
    // Use a reference of 10000 views for normalization
    const maxViewCount = 10000;
    const popBonus = computePopularityBonus(article, maxViewCount, config.popularityWeight);
    if (popBonus) {
      score += popBonus.bonus;
      reasons.push({
        type: "popularity-bonus",
        reason: popBonus.reason,
        bonus: popBonus.bonus,
      });
    }
  }

  // 6. Recency bonus
  if (config.recencyWeight) {
    const recBonus = computeRecencyBonus(article, config.recencyWeight);
    if (recBonus) {
      score += recBonus.bonus;
      reasons.push({
        type: "recency-bonus",
        reason: recBonus.reason,
        bonus: recBonus.bonus,
      });
    }
  }

  if (score > 0) {
    return {
      suggestion: {
        articleId: article.id,
        title: article.title,
        summary: article.summary,
        score,
        category: article.category,
      },
      reasons,
    };
  }

  return null;
}

/**
 * Compute scores for multiple articles in one pass.
 */
export function computeScores(
  articles: KbArticle[],
  queryTokens: string[],
  config: SuggestionConfig,
): Array<{ suggestion: KbSuggestion; reasons: KbMatchReason[] } | null> {
  return articles.map((article) => scoreArticle(article, queryTokens, config));
}
