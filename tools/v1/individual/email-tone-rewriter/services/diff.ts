/**
 * Email Tone Rewriter — word-level diff engine.
 *
 * Compares two strings (original and rewrite) and produces a sequence of
 * segments tagged as unchanged, added, or removed. Uses a Longest Common
 * Subsequence (LCS) approach at the word level to identify what changed.
 * Pure and deterministic: no network calls, no mutations of input.
 */

export type DiffSegmentType = "unchanged" | "added" | "removed";

export interface DiffSegment {
  type: DiffSegmentType;
  text: string;
}

/**
 * Splits text into word tokens, preserving whitespace runs as separators.
 * Returns an array of tokens and their associated whitespace.
 */
export function tokenize(text: string): string[] {
  const normalized = text.normalize("NFC").replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return [];
  return normalized.split(" ");
}

/**
 * Builds an LCS table for two arrays of tokens.
 * Returns a 2D array where lcs[i][j] is the length of LCS for
 * prefix a[0..i-1] and b[0..j-1].
 */
export function buildLCSTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Backtracks through an LCS table to produce a sequence of diff segments.
 */
export function backtrack(a: string[], b: string[], dp: number[][]): DiffSegment[] {
  const segments: DiffSegment[] = [];
  let i = a.length;
  let j = b.length;

  const reversed: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      reversed.push({ type: "unchanged", text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversed.push({ type: "added", text: b[j - 1] });
      j--;
    } else {
      reversed.push({ type: "removed", text: a[i - 1] });
      i--;
    }
  }

  // Reverse to get the correct order and merge consecutive same-type segments.
  for (let k = reversed.length - 1; k >= 0; k--) {
    const seg = reversed[k];
    const last = segments[segments.length - 1];
    if (last && last.type === seg.type) {
      last.text += " " + seg.text;
    } else {
      segments.push({ type: seg.type, text: seg.text });
    }
  }

  return segments;
}

/**
 * Computes a word-level diff between two text strings.
 * Returns an array of segments tagged as unchanged, added, or removed.
 */
export function computeDiff(original: string, rewritten: string): DiffSegment[] {
  const a = tokenize(original);
  const b = tokenize(rewritten);

  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return [{ type: "added", text: rewritten }];
  if (b.length === 0) return [{ type: "removed", text: original }];

  const dp = buildLCSTable(a, b);
  return backtrack(a, b, dp);
}

/**
 * Returns a human-readable summary of a diff result.
 */
export function summarizeDiff(segments: DiffSegment[]): string {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const seg of segments) {
    const wordCount = seg.text.split(/\s+/).filter(Boolean).length;
    if (seg.type === "added") added += wordCount;
    else if (seg.type === "removed") removed += wordCount;
    else unchanged += wordCount;
  }

  const total = added + removed + unchanged;
  const percent = total > 0 ? Math.round(((added + removed) / total) * 100) : 0;

  return `${added} words added, ${removed} words removed, ${unchanged} words unchanged (${percent}% changed)`;
}

/**
 * Returns only the segments that represent actual changes (additions and removals).
 */
export function changesOnly(segments: DiffSegment[]): DiffSegment[] {
  return segments.filter((s) => s.type !== "unchanged");
}

/**
 * Renders a diff into a simple text representation where:
 * - Added text is wrapped in [+ ... +]
 * - Removed text is wrapped in [- ... -]
 * - Unchanged text is kept as-is
 */
export function renderDiff(segments: DiffSegment[]): string {
  return segments
    .map((seg) => {
      switch (seg.type) {
        case "added":
          return `[+${seg.text}+]`;
        case "removed":
          return `[-${seg.text}-]`;
        case "unchanged":
          return seg.text;
      }
    })
    .join(" ");
}

/**
 * Merges adjacent segments of the same type into single segments.
 * Useful for simplifying a diff before rendering.
 */
export function mergeAdjacent(segments: DiffSegment[]): DiffSegment[] {
  const merged: DiffSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) {
      last.text += " " + seg.text;
    } else {
      merged.push({ type: seg.type, text: seg.text });
    }
  }
  return merged;
}

/**
 * Returns the word-level change rate as a number between 0 and 1.
 * 0 means identical, 1 means completely different.
 */
export function changeRate(original: string, rewritten: string): number {
  const segments = computeDiff(original, rewritten);
  let changed = 0;
  let total = 0;

  for (const seg of segments) {
    const words = seg.text.split(/\s+/).filter(Boolean).length;
    total += words;
    if (seg.type !== "unchanged") {
      changed += words;
    }
  }

  return total > 0 ? changed / total : 0;
}
