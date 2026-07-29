/**
 * Email Tone Rewriter — multi-tone comparison service.
 *
 * Rewrites a single draft into all supported tones simultaneously and returns
 * the results side by side. Useful for preview interfaces where the user wants
 * to compare how different tones affect their draft before choosing one.
 * Pure service: no side effects, no state mutation.
 */

import {
  rewriteEmailTone,
  type RewriteRequest,
  type ToneRewrite,
  type ToneId,
  SUPPORTED_TONES,
} from "./emailToneRewriter";
import { safeRewriteEmailTone } from "./guards";

export interface ToneComparisonItem {
  /** The tone that was applied. */
  tone: ToneId;
  /** The rewrite result, or null if the rewrite failed. */
  rewrite: ToneRewrite | null;
  /** Error message if the rewrite failed. */
  error: string | null;
  /** Word count of the rewritten body. */
  wordCount: number;
  /** Whether the rewrite differs from the original. */
  changed: boolean;
  /** Whether the rewrite was truncated. */
  truncated: boolean;
  /** Number of preserved key points. */
  keyPointCount: number;
}

export interface ToneComparison {
  /** The original draft that was rewritten. */
  original: RewriteRequest;
  /** Results for each tone, in the order they were requested. */
  results: ToneComparisonItem[];
  /** Total number of successful rewrites. */
  successCount: number;
  /** Total number of failed rewrites. */
  errorCount: number;
  /** The tone that produced the shortest rewrite. */
  shortestTone: ToneId | null;
  /** The tone that produced the longest rewrite. */
  longestTone: ToneId | null;
  /** The tone that changed the most from the original. */
  mostChangedTone: ToneId | null;
  /** The tone that changed the least from the original. */
  leastChangedTone: ToneId | null;
}

/**
 * Rewrites a single draft into all supported tones.
 * Returns a comparison object with results for each tone.
 */
export function compareAllTones(draft: RewriteRequest): ToneComparison {
  const tones: ToneId[] = [...SUPPORTED_TONES];
  const results: ToneComparisonItem[] = [];

  for (const tone of tones) {
    const toneDraft: RewriteRequest = { ...draft, tone };
    const result = safeRewriteEmailTone(toneDraft);

    if (result.status === "error") {
      results.push({
        tone,
        rewrite: null,
        error: "message" in result ? result.message : "Unknown error",
        wordCount: 0,
        changed: false,
        truncated: false,
        keyPointCount: 0,
      });
    } else {
      results.push({
        tone,
        rewrite: result.rewrite,
        error: null,
        wordCount: result.rewrite.wordCount,
        changed: result.rewrite.changed,
        truncated: result.rewrite.truncated,
        keyPointCount: result.rewrite.preservedKeyPoints.length,
      });
    }
  }

  const successCount = results.filter((r) => r.rewrite !== null).length;
  const errorCount = results.length - successCount;

  const validResults = results.filter((r) => r.rewrite !== null);
  const sortedByLength = [...validResults].sort((a, b) => a.wordCount - b.wordCount);
  const sortedByChange = [...validResults].sort((a, b) => {
    const aChanged = a.changed ? 1 : 0;
    const bChanged = b.changed ? 1 : 0;
    return bChanged - aChanged;
  });

  return {
    original: draft,
    results,
    successCount,
    errorCount,
    shortestTone: sortedByLength.length > 0 ? sortedByLength[0].tone : null,
    longestTone: sortedByLength.length > 0 ? sortedByLength[sortedByLength.length - 1].tone : null,
    mostChangedTone: sortedByChange.length > 0 ? sortedByChange[0].tone : null,
    leastChangedTone:
      sortedByChange.length > 0 ? sortedByChange[sortedByChange.length - 1].tone : null,
  };
}

/**
 * Rewrites a draft into a specific set of tones.
 * Useful when the user only wants to compare a subset of tones.
 */
export function compareTones(draft: RewriteRequest, tones: ToneId[]): ToneComparison {
  const results: ToneComparisonItem[] = [];

  for (const tone of tones) {
    const toneDraft: RewriteRequest = { ...draft, tone };
    const result = safeRewriteEmailTone(toneDraft);

    if (result.status === "error") {
      results.push({
        tone,
        rewrite: null,
        error: "message" in result ? result.message : "Unknown error",
        wordCount: 0,
        changed: false,
        truncated: false,
        keyPointCount: 0,
      });
    } else {
      results.push({
        tone,
        rewrite: result.rewrite,
        error: null,
        wordCount: result.rewrite.wordCount,
        changed: result.rewrite.changed,
        truncated: result.rewrite.truncated,
        keyPointCount: result.rewrite.preservedKeyPoints.length,
      });
    }
  }

  const successCount = results.filter((r) => r.rewrite !== null).length;
  const errorCount = results.length - successCount;

  const validResults = results.filter((r) => r.rewrite !== null);
  const sortedByLength = [...validResults].sort((a, b) => a.wordCount - b.wordCount);
  const sortedByChange = [...validResults].sort((a, b) => {
    const aChanged = a.changed ? 1 : 0;
    const bChanged = b.changed ? 1 : 0;
    return bChanged - aChanged;
  });

  return {
    original: draft,
    results,
    successCount,
    errorCount,
    shortestTone: sortedByLength.length > 0 ? sortedByLength[0].tone : null,
    longestTone: sortedByLength.length > 0 ? sortedByLength[sortedByLength.length - 1].tone : null,
    mostChangedTone: sortedByChange.length > 0 ? sortedByChange[0].tone : null,
    leastChangedTone:
      sortedByChange.length > 0 ? sortedByChange[sortedByChange.length - 1].tone : null,
  };
}

/**
 * Returns a summary of the differences between two tone results.
 */
export function compareTwoTones(
  draft: RewriteRequest,
  toneA: ToneId,
  toneB: ToneId,
): {
  a: ToneComparisonItem;
  b: ToneComparisonItem;
  wordDifference: number;
  sameLength: boolean;
  bothChanged: boolean;
  bothTruncated: boolean;
} {
  const comparison = compareTones(draft, [toneA, toneB]);
  const a = comparison.results[0];
  const b = comparison.results[1];

  return {
    a,
    b,
    wordDifference: Math.abs(a.wordCount - b.wordCount),
    sameLength: a.wordCount === b.wordCount,
    bothChanged: a.changed && b.changed,
    bothTruncated: a.truncated && b.truncated,
  };
}

/**
 * Finds the tone that produces the shortest rewrite for a given draft.
 */
export function findShortestTone(draft: RewriteRequest): ToneId | null {
  const comparison = compareAllTones(draft);
  return comparison.shortestTone;
}

/**
 * Finds the tone that produces the longest rewrite for a given draft.
 */
export function findLongestTone(draft: RewriteRequest): ToneId | null {
  const comparison = compareAllTones(draft);
  return comparison.longestTone;
}

/**
 * Returns the word count range across all tones for a draft.
 */
export function wordCountRange(draft: RewriteRequest): { min: number; max: number; range: number } {
  const comparison = compareAllTones(draft);
  const validResults = comparison.results.filter((r) => r.rewrite !== null);

  if (validResults.length === 0) {
    return { min: 0, max: 0, range: 0 };
  }

  const wordCounts = validResults.map((r) => r.wordCount);
  const min = Math.min(...wordCounts);
  const max = Math.max(...wordCounts);

  return { min, max, range: max - min };
}

/**
 * Returns the tone that preserves the most key points for a given draft.
 */
export function findMostPreservingTone(draft: RewriteRequest): ToneId | null {
  const comparison = compareAllTones(draft);
  const validResults = comparison.results.filter((r) => r.rewrite !== null);

  if (validResults.length === 0) return null;

  let maxPoints = 0;
  let bestTone: ToneId | null = null;

  for (const result of validResults) {
    if (result.keyPointCount > maxPoints) {
      maxPoints = result.keyPointCount;
      bestTone = result.tone;
    }
  }

  return bestTone;
}

/**
 * Returns a matrix of word counts for each tone.
 * Rows are tones, columns are drafts.
 */
export function wordCountMatrix(
  drafts: RewriteRequest[],
): Array<{ draft: RewriteRequest; counts: Record<string, number> }> {
  return drafts.map((draft) => {
    const comparison = compareAllTones(draft);
    const counts: Record<string, number> = {};
    for (const result of comparison.results) {
      counts[result.tone] = result.wordCount;
    }
    return { draft, counts };
  });
}

/**
 * Returns the tone that produces the most consistent word counts
 * across multiple drafts (lowest variance).
 */
export function mostConsistentTone(drafts: RewriteRequest[]): ToneId | null {
  const matrix = wordCountMatrix(drafts);
  const toneVariances: Record<string, number[]> = {};

  for (const row of matrix) {
    for (const [tone, count] of Object.entries(row.counts)) {
      if (!toneVariances[tone]) {
        toneVariances[tone] = [];
      }
      toneVariances[tone].push(count);
    }
  }

  let minVariance = Infinity;
  let bestTone: ToneId | null = null;

  for (const [tone, counts] of Object.entries(toneVariances)) {
    if (counts.length < 2) continue;
    const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
    const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
    if (variance < minVariance) {
      minVariance = variance;
      bestTone = tone as ToneId;
    }
  }

  return bestTone;
}

/**
 * Ranks tones by how short they make the draft (1 = shortest).
 */
export function rankTonesByLength(
  draft: RewriteRequest,
): Array<{ tone: ToneId; rank: number; wordCount: number }> {
  const comparison = compareAllTones(draft);
  const validResults = comparison.results
    .filter((r) => r.rewrite !== null)
    .sort((a, b) => a.wordCount - b.wordCount);

  return validResults.map((r, i) => ({
    tone: r.tone,
    rank: i + 1,
    wordCount: r.wordCount,
  }));
}

/**
 * Returns the tone that produces the most similar result to the original
 * (least amount of change).
 */
export function findMostSimilarTone(draft: RewriteRequest): ToneId | null {
  const comparison = compareAllTones(draft);
  const validResults = comparison.results.filter((r) => r.rewrite !== null);

  if (validResults.length === 0) return null;

  let minChange = Infinity;
  let bestTone: ToneId | null = null;

  for (const result of validResults) {
    const originalWords = draft.bodyText.split(/\s+/).filter(Boolean).length;
    const rewriteWords = result.wordCount;
    const change = Math.abs(originalWords - rewriteWords);
    if (change < minChange) {
      minChange = change;
      bestTone = result.tone;
    }
  }

  return bestTone;
}
