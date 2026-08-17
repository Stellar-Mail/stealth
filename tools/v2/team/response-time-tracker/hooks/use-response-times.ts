import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  DateRange,
  FetchState,
  ResponseTimeEntry,
  ResponseTimeMetrics,
  TeamMember,
} from "../types";
import {
  createResponseTimeService,
  type ResponseTimeService,
} from "../services/response-time-service";

interface ResponseTimesState {
  entries: FetchState<ResponseTimeEntry[]>;
  metrics: FetchState<ResponseTimeMetrics>;
  teamMembers: FetchState<TeamMember[]>;
}

type Action =
  | { type: "LOAD_ENTRIES_START" }
  | { type: "LOAD_ENTRIES_DONE"; data: ResponseTimeEntry[] }
  | { type: "LOAD_ENTRIES_ERROR"; message: string }
  | { type: "LOAD_METRICS_START" }
  | { type: "LOAD_METRICS_DONE"; data: ResponseTimeMetrics }
  | { type: "LOAD_METRICS_ERROR"; message: string }
  | { type: "LOAD_MEMBERS_START" }
  | { type: "LOAD_MEMBERS_DONE"; data: TeamMember[] }
  | { type: "LOAD_MEMBERS_ERROR"; message: string };

function entriesReducer(
  prev: FetchState<ResponseTimeEntry[]>,
  data: ResponseTimeEntry[],
): FetchState<ResponseTimeEntry[]> {
  return data.length === 0 ? { status: "empty" } : { status: "success", data };
}

function initialState(): ResponseTimesState {
  return {
    entries: { status: "loading" },
    metrics: { status: "loading" },
    teamMembers: { status: "loading" },
  };
}

function reducer(state: ResponseTimesState, action: Action): ResponseTimesState {
  switch (action.type) {
    case "LOAD_ENTRIES_START":
      return { ...state, entries: { status: "loading" } };
    case "LOAD_ENTRIES_DONE":
      return { ...state, entries: entriesReducer(state.entries, action.data) };
    case "LOAD_ENTRIES_ERROR":
      return { ...state, entries: { status: "error", message: action.message } };
    case "LOAD_METRICS_START":
      return { ...state, metrics: { status: "loading" } };
    case "LOAD_METRICS_DONE":
      return {
        ...state,
        metrics:
          action.data.totalResponses === 0
            ? { status: "empty" }
            : { status: "success", data: action.data },
      };
    case "LOAD_METRICS_ERROR":
      return { ...state, metrics: { status: "error", message: action.message } };
    case "LOAD_MEMBERS_START":
      return { ...state, teamMembers: { status: "loading" } };
    case "LOAD_MEMBERS_DONE":
      return { ...state, teamMembers: { status: "success", data: action.data } };
    case "LOAD_MEMBERS_ERROR":
      return { ...state, teamMembers: { status: "error", message: action.message } };
    default:
      return state;
  }
}

export function useResponseTimes(service?: ResponseTimeService) {
  const svc = service ?? createResponseTimeService();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const abortRef = useRef(false);

  const load = useCallback(
    async (range?: DateRange) => {
      abortRef.current = false;

      dispatch({ type: "LOAD_ENTRIES_START" });
      dispatch({ type: "LOAD_METRICS_START" });
      dispatch({ type: "LOAD_MEMBERS_START" });

      try {
        const [entries, metrics, teamMembers] = await Promise.all([
          svc.getEntries(range),
          svc.getMetrics(range),
          svc.getTeamMembers(),
        ]);

        if (abortRef.current) return;

        dispatch({ type: "LOAD_ENTRIES_DONE", data: entries });
        dispatch({ type: "LOAD_METRICS_DONE", data: metrics });
        dispatch({ type: "LOAD_MEMBERS_DONE", data: teamMembers });
      } catch (err) {
        if (abortRef.current) return;
        const message = err instanceof Error ? err.message : "An unexpected error occurred.";
        dispatch({ type: "LOAD_ENTRIES_ERROR", message });
        dispatch({ type: "LOAD_METRICS_ERROR", message });
        dispatch({ type: "LOAD_MEMBERS_ERROR", message });
      }
    },
    [svc],
  );

  const retry = useCallback(
    (range?: DateRange) => {
      load(range);
    },
    [load],
  );

  useEffect(() => {
    load();
    return () => {
      abortRef.current = true;
    };
  }, [load]);

  return { ...state, retry, load };
}

export type { ResponseTimesState };
