/**
 * use-watchlist.ts — Suspicious Sender Watchlist
 *
 * React hook wrapping the watchlist service with full FetchState lifecycle.
 *
 * Inputs:
 *   service?       – optional WatchlistService (default: createWatchlistService())
 *   initialFilter? – optional WatchlistFilter applied at mount
 *
 * Outputs (from the hook):
 *   entries   : FetchState<WatchlistEntry[]>
 *   metrics   : FetchState<WatchlistMetrics>
 *   addEntry(input)        → Promise<void>
 *   updateRisk(input)      → Promise<void>
 *   dismissEntry(id)       → Promise<void>
 *   removeEntry(id)        → Promise<void>
 *   reload(filter?)        → Promise<void>
 *
 * Error state: both `entries` and `metrics` switch to { status: "error", message }
 * when the service rejects.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  AddEntryInput,
  FetchState,
  UpdateRiskInput,
  WatchlistEntry,
  WatchlistFilter,
  WatchlistMetrics,
} from "../types";
import { createWatchlistService, type WatchlistService } from "../services/watchlist.service";

interface WatchlistState {
  entries: FetchState<WatchlistEntry[]>;
  metrics: FetchState<WatchlistMetrics>;
}

type Action =
  | { type: "LOAD_START" }
  | { type: "LOAD_DONE"; entries: WatchlistEntry[]; metrics: WatchlistMetrics }
  | { type: "LOAD_ERROR"; message: string };

function reducer(state: WatchlistState, action: Action): WatchlistState {
  switch (action.type) {
    case "LOAD_START":
      return { entries: { status: "loading" }, metrics: { status: "loading" } };
    case "LOAD_DONE":
      return {
        entries:
          action.entries.length === 0
            ? { status: "empty" }
            : { status: "success", data: action.entries },
        metrics: { status: "success", data: action.metrics },
      };
    case "LOAD_ERROR":
      return {
        entries: { status: "error", message: action.message },
        metrics: { status: "error", message: action.message },
      };
    default:
      return state;
  }
}

function init(): WatchlistState {
  return { entries: { status: "loading" }, metrics: { status: "loading" } };
}

export interface UseWatchlistOptions {
  service?: WatchlistService;
  initialFilter?: WatchlistFilter;
}

export function useWatchlist(options: UseWatchlistOptions = {}) {
  const svc = options.service ?? createWatchlistService();
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const abortedRef = useRef(false);

  const reload = useCallback(
    async (filter?: WatchlistFilter) => {
      abortedRef.current = false;
      dispatch({ type: "LOAD_START" });
      try {
        const [entries, metrics] = await Promise.all([
          svc.getEntries(filter ?? options.initialFilter ?? {}),
          svc.getMetrics(),
        ]);
        if (abortedRef.current) return;
        dispatch({ type: "LOAD_DONE", entries, metrics });
      } catch (err) {
        if (abortedRef.current) return;
        dispatch({
          type: "LOAD_ERROR",
          message: err instanceof Error ? err.message : "Unexpected error.",
        });
      }
    },
    [svc, options.initialFilter],
  );

  useEffect(() => {
    reload();
    return () => {
      abortedRef.current = true;
    };
  }, [reload]);

  const addEntry = useCallback(
    async (input: AddEntryInput) => {
      await svc.addEntry(input);
      await reload();
    },
    [svc, reload],
  );

  const updateRisk = useCallback(
    async (input: UpdateRiskInput) => {
      await svc.updateRisk(input);
      await reload();
    },
    [svc, reload],
  );

  const dismissEntry = useCallback(
    async (id: string) => {
      await svc.dismissEntry(id);
      await reload();
    },
    [svc, reload],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      await svc.removeEntry(id);
      await reload();
    },
    [svc, reload],
  );

  return {
    entries: state.entries,
    metrics: state.metrics,
    addEntry,
    updateRisk,
    dismissEntry,
    removeEntry,
    reload,
  };
}

export type UseWatchlistReturn = ReturnType<typeof useWatchlist>;
