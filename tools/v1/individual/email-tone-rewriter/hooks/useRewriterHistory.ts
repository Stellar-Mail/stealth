/**
 * useRewriterHistory — React hook for in-memory rewrite history.
 *
 * Tracks the last N rewrites performed during the current session. History is
 * stored in React state and is not persisted across page reloads. Each entry
 * records the original draft, the resulting rewrite, and a timestamp.
 */

import { useState, useCallback, useRef } from "react";
import type { RewriteRequest, ToneRewrite } from "../services/emailToneRewriter";

/** Maximum number of history entries kept in memory. */
const MAX_HISTORY = 50;

export interface HistoryEntry {
  /** Monotonically increasing sequence number. */
  id: number;
  /** The draft that was submitted for rewriting. */
  request: RewriteRequest;
  /** The rewrite result produced by the engine. */
  rewrite: ToneRewrite;
  /** Timestamp (epoch ms) when the rewrite completed. */
  timestamp: number;
  /** User-provided label for this entry, if any. */
  label?: string;
}

export interface UseRewriterHistoryReturn {
  /** All history entries, newest first. */
  entries: HistoryEntry[];
  /** Pushes a new entry onto the history stack. */
  push: (request: RewriteRequest, rewrite: ToneRewrite) => HistoryEntry;
  /** Removes a single entry by its id. */
  remove: (id: number) => void;
  /** Clears all history entries. */
  clear: () => void;
  /** Returns the most recent entry, or null if history is empty. */
  latest: HistoryEntry | null;
  /** Total number of entries currently stored. */
  count: number;
  /** Labels an existing entry with a user-provided string. */
  label: (id: number, label: string) => void;
  /** Exports history as a JSON-serializable array. */
  export: () => HistoryEntry[];
}

export function useRewriterHistory(maxEntries: number = MAX_HISTORY): UseRewriterHistoryReturn {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const counterRef = useRef(0);

  const push = useCallback(
    (request: RewriteRequest, rewrite: ToneRewrite): HistoryEntry => {
      counterRef.current += 1;
      const entry: HistoryEntry = {
        id: counterRef.current,
        request,
        rewrite,
        timestamp: Date.now(),
      };
      setEntries((prev) => {
        const next = [entry, ...prev];
        return next.length > maxEntries ? next.slice(0, maxEntries) : next;
      });
      return entry;
    },
    [maxEntries],
  );

  const remove = useCallback((id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  const label = useCallback((id: number, labelText: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, label: labelText } : e)));
  }, []);

  const exportHistory = useCallback((): HistoryEntry[] => {
    return entries;
  }, [entries]);

  const latest = entries.length > 0 ? entries[0] : null;

  return {
    entries,
    push,
    remove,
    clear,
    latest,
    count: entries.length,
    label,
    export: exportHistory,
  };
}
