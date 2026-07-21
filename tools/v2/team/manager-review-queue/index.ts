/**
 * index.ts — Manager Review Queue
 *
 * Folder-local API surface for the non-UI execution contract. Nothing in
 * this file imports React or touches the DOM — it is safe to import from a
 * backend job, script, or test with no UI runtime present.
 */

// Types (existing)
export type {
  ReviewItem,
  ReviewItemStatus,
  QueueFilters,
  FetchQueueInput,
  FetchQueueOutput,
  UpdateReviewStatusInput,
} from "./types";

// Contract
export {
  ReviewErrorCode,
  applyReviewOperation,
  validateFetchInput,
  validateUpdateStatusInput,
  MAX_QUEUE_SIZE,
  ok,
  fail,
} from "./contract";
export type {
  ReviewContract,
  ReviewOperation,
  ReviewContractOutput,
  ReviewResult,
} from "./contract";

// Service (concrete, fixture-backed contract implementation)
export { createReviewQueueContract } from "./services/execution.service";

// Fixtures
export {
  VALID_FETCH_INPUT,
  VALID_UPDATE_STATUS_INPUT,
  INVALID_LIMIT_FETCH_INPUT,
  OVERSIZED_LIMIT_FETCH_INPUT,
  MISSING_ITEM_ID_UPDATE_INPUT,
  UNKNOWN_ITEM_UPDATE_INPUT,
  INVALID_TRANSITION_UPDATE_INPUT,
} from "./fixtures/contractFixtures";
