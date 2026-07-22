export { useWorkloadBalancer } from "./hooks/use-workload-balancer";
export {
  createWorkloadService,
  calculateWorkloadMetrics,
  balanceWorkload,
  suggestAssignment,
} from "./services/workload-service";

// Non-UI execution contract
export { createWorkloadContract } from "./contract";
export { WorkloadErrorCode, validateBalanceInput, ok, fail } from "./contract";
export type {
  WorkloadContract,
  WorkloadOperation,
  WorkloadContractOutput,
  WorkloadResult,
} from "./contract";

export type {
  AssignmentSuggestion,
  BalanceResult,
  BalancerConfig,
  BalancingStrategy,
  DateRange,
  FetchState,
  ItemStatus,
  MemberWorkload,
  Priority,
  TeamMember,
  WorkloadItem,
  WorkloadMetrics,
} from "./types";
