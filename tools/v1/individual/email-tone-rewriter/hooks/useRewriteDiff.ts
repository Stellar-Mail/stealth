/**
 * useRewriteDiff — React hook for comparing original and rewritten text.
 *
 * Computes a word-level diff between the original draft body and the rewritten
 * output, highlighting additions, deletions, and unchanged segments. Useful for
 * review interfaces where the user wants to see exactly what changed.
 */

import { useState, useCallback, useMemo } from "react";
import type { ToneRewrite } from "../services/emailToneRewriter";
import { computeDiff, type DiffSegment } from "../services/diff";

export interface UseRewriteDiffReturn {
  /** The diff segments for the current comparison. */
  segments: DiffSegment[];
  /** Whether a diff is currently available. */
  hasDiff: boolean;
  /** Statistics about the diff. */
  stats: DiffStats;
  /** Sets the rewrite to diff against its source. */
  setRewrite: (rewrite: ToneRewrite) => void;
  /** Clears the current diff. */
  clear: () => void;
  /** Toggles whether to show only the changed segments. */
  showChangesOnly: boolean;
  setShowChangesOnly: (value: boolean) => void;
}

export interface DiffStats {
  /** Number of words added in the rewrite. */
  added: number;
  /** Number of words removed from the original. */
  removed: number;
  /** Number of words that stayed the same. */
  unchanged: number;
  /** Percentage of words that changed (0-100). */
  changePercent: number;
  /** Total word count of the original. */
  originalWords: number;
  /** Total word count of the rewrite. */
  rewriteWords: number;
}

function computeStats(segments: DiffSegment[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const seg of segments) {
    const words = seg.text.split(/\s+/).filter(Boolean).length;
    if (seg.type === "added") added += words;
    else if (seg.type === "removed") removed += words;
    else unchanged += words;
  }

  const total = added + removed + unchanged;
  const changePercent = total > 0 ? Math.round(((added + removed) / total) * 100) : 0;

  return {
    added,
    removed,
    unchanged,
    changePercent,
    originalWords: unchanged + removed,
    rewriteWords: unchanged + added,
  };
}

export function useRewriteDiff(): UseRewriteDiffReturn {
  const [rewrite, setRewriteState] = useState<ToneRewrite | null>(null);
  const [showChangesOnly, setShowChangesOnly] = useState(false);

  const setRewrite = useCallback((r: ToneRewrite) => {
    setRewriteState(r);
  }, []);

  const clear = useCallback(() => {
    setRewriteState(null);
  }, []);

  const segments = useMemo<DiffSegment[]>(() => {
    if (!rewrite) return [];
    const allSegments = computeDiff(rewrite.source.bodyText, rewrite.rewrittenBody);
    if (!showChangesOnly) return allSegments;
    return allSegments.filter((s) => s.type !== "unchanged");
  }, [rewrite, showChangesOnly]);

  const stats = useMemo<DiffStats>(() => {
    if (!rewrite) {
      return {
        added: 0,
        removed: 0,
        unchanged: 0,
        changePercent: 0,
        originalWords: 0,
        rewriteWords: 0,
      };
    }
    const allSegments = computeDiff(rewrite.source.bodyText, rewrite.rewrittenBody);
    return computeStats(allSegments);
  }, [rewrite]);

  return {
    segments,
    hasDiff: rewrite !== null,
    stats,
    setRewrite,
    clear,
    showChangesOnly,
    setShowChangesOnly,
  };
}
