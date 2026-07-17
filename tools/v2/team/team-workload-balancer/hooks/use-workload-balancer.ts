import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  BalanceResult,
  BalancerConfig,
  FetchState,
  TeamMember,
  WorkloadItem,
  WorkloadMetrics,
} from "../types";
import { createWorkloadService, type WorkloadService } from "../services/workload-service";

interface WorkloadBalancerState {
  teamMembers: FetchState<TeamMember[]>;
  workloadItems: FetchState<WorkloadItem[]>;
  metrics: FetchState<WorkloadMetrics>;
  balanceResult: FetchState<BalanceResult>;
}

type Action =
  | { type: "LOAD_MEMBERS_START" }
  | { type: "LOAD_MEMBERS_DONE"; data: TeamMember[] }
  | { type: "LOAD_MEMBERS_ERROR"; message: string }
  | { type: "LOAD_ITEMS_START" }
  | { type: "LOAD_ITEMS_DONE"; data: WorkloadItem[] }
  | { type: "LOAD_ITEMS_ERROR"; message: string }
  | { type: "LOAD_METRICS_START" }
  | { type: "LOAD_METRICS_DONE"; data: WorkloadMetrics }
  | { type: "LOAD_METRICS_ERROR"; message: string }
  | { type: "LOAD_BALANCE_START" }
  | { type: "LOAD_BALANCE_DONE"; data: BalanceResult }
  | { type: "LOAD_BALANCE_ERROR"; message: string };

function initialState(): WorkloadBalancerState {
  return {
    teamMembers: { status: "loading" },
    workloadItems: { status: "loading" },
    metrics: { status: "loading" },
    balanceResult: { status: "loading" },
  };
}

function reducer(state: WorkloadBalancerState, action: Action): WorkloadBalancerState {
  switch (action.type) {
    case "LOAD_MEMBERS_START":
      return { ...state, teamMembers: { status: "loading" } };
    case "LOAD_MEMBERS_DONE":
      return { ...state, teamMembers: { status: "success", data: action.data } };
    case "LOAD_MEMBERS_ERROR":
      return { ...state, teamMembers: { status: "error", message: action.message } };
    case "LOAD_ITEMS_START":
      return { ...state, workloadItems: { status: "loading" } };
    case "LOAD_ITEMS_DONE":
      return {
        ...state,
        workloadItems:
          action.data.length === 0 ? { status: "empty" } : { status: "success", data: action.data },
      };
    case "LOAD_ITEMS_ERROR":
      return { ...state, workloadItems: { status: "error", message: action.message } };
    case "LOAD_METRICS_START":
      return { ...state, metrics: { status: "loading" } };
    case "LOAD_METRICS_DONE":
      return {
        ...state,
        metrics:
          action.data.totalItems === 0
            ? { status: "empty" }
            : { status: "success", data: action.data },
      };
    case "LOAD_METRICS_ERROR":
      return { ...state, metrics: { status: "error", message: action.message } };
    case "LOAD_BALANCE_START":
      return { ...state, balanceResult: { status: "loading" } };
    case "LOAD_BALANCE_DONE":
      return {
        ...state,
        balanceResult:
          action.data.assignments.length === 0
            ? { status: "empty" }
            : { status: "success", data: action.data },
      };
    case "LOAD_BALANCE_ERROR":
      return { ...state, balanceResult: { status: "error", message: action.message } };
    default:
      return state;
  }
}

export function useWorkloadBalancer(service?: WorkloadService) {
  const svc = service ?? createWorkloadService();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const abortRef = useRef(false);

  const load = useCallback(async () => {
    abortRef.current = false;

    dispatch({ type: "LOAD_MEMBERS_START" });
    dispatch({ type: "LOAD_ITEMS_START" });
    dispatch({ type: "LOAD_METRICS_START" });

    try {
      const [members, items, metrics] = await Promise.all([
        svc.getTeamMembers(),
        svc.getWorkloadItems(),
        svc.getWorkloadMetrics(),
      ]);

      if (abortRef.current) return;

      dispatch({ type: "LOAD_MEMBERS_DONE", data: members });
      dispatch({ type: "LOAD_ITEMS_DONE", data: items });
      dispatch({ type: "LOAD_METRICS_DONE", data: metrics });
    } catch (err) {
      if (abortRef.current) return;
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      dispatch({ type: "LOAD_MEMBERS_ERROR", message });
      dispatch({ type: "LOAD_ITEMS_ERROR", message });
      dispatch({ type: "LOAD_METRICS_ERROR", message });
    }
  }, [svc]);

  const runBalancer = useCallback(
    async (config: BalancerConfig) => {
      abortRef.current = false;
      dispatch({ type: "LOAD_BALANCE_START" });

      try {
        const result = await svc.getBalanceSuggestions(config);
        if (abortRef.current) return;
        dispatch({ type: "LOAD_BALANCE_DONE", data: result });
      } catch (err) {
        if (abortRef.current) return;
        const message = err instanceof Error ? err.message : "An unexpected error occurred.";
        dispatch({ type: "LOAD_BALANCE_ERROR", message });
      }
    },
    [svc],
  );

  const retry = useCallback(() => {
    load();
  }, [load]);

  useEffect(() => {
    load();
    return () => {
      abortRef.current = true;
    };
  }, [load]);

  return { ...state, retry, load, runBalancer };
}

export type { WorkloadBalancerState };
