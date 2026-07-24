/**
 * services/execution.service.ts — Manager Review Queue
 *
 * Wraps the pure `applyReviewOperation` reducer with real state and network
 * simulation. This is the concrete `ReviewContract` implementation that
 * backend callers construct and use.
 */

import type { ReviewItem } from "../types";
import type {
  ReviewContract,
  ReviewOperation,
  ReviewContractOutput,
  ReviewResult,
} from "../contract";
import { applyReviewOperation } from "../contract";
import { mockQueueItems, MOCK_NETWORK_DELAY_MS } from "../fixtures/reviewFixtures";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates a `ReviewContract` instance backed by an in-memory store seeded
 * from fixtures. Each call is independent — pass a fresh store per test to
 * avoid cross-test pollution.
 */
export function createReviewQueueContract(
  seed: ReviewItem[] = mockQueueItems,
  networkDelayMs: number = MOCK_NETWORK_DELAY_MS,
): ReviewContract {
  const store = new Map<string, ReviewItem>(seed.map((item) => [item.id, item]));

  return {
    async execute(op: ReviewOperation): Promise<ReviewResult<ReviewContractOutput>> {
      if (networkDelayMs > 0) await delay(networkDelayMs);
      return applyReviewOperation(store, op);
    },
  };
}
