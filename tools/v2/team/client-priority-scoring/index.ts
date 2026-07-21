/**
 * index.ts — Client Priority Scoring
 *
 * Folder-local API surface. Exports the non-UI execution contract, its types,
 * and the service factory. Nothing here imports from the main app.
 */

// Types
export type {
  ClientSignal,
  ClientForScoring,
  ScoredClient,
  ScoreClientsInput,
  PriorityOrder,
} from "./types";

// Contract + service
export { createPriorityContract } from "./services/client-priority.service";
export {
  PriorityErrorCode,
  scoreClients,
  validateClient,
  validateScoreInput,
  ok,
  fail,
} from "./contract";
export type {
  PriorityContract,
  PriorityOperation,
  PriorityContractOutput,
  PriorityResult,
} from "./contract";

// Fixtures
export { PRIORITY_FIXTURES, EMPTY_CLIENTS } from "./fixtures";
