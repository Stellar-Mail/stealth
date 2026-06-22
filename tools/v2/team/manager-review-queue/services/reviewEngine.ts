import { FetchQueueInput, FetchQueueOutput, UpdateReviewStatusInput, ReviewItem } from "../types";
import { mockQueueItems, MOCK_NETWORK_DELAY_MS } from "../fixtures/reviewFixtures";

// In-memory store to simulate database state for this session
let localStore: ReviewItem[] = [...mockQueueItems];

/**
 * Simulates network latency for deterministic mock behavior
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches review queue items based on provided filters.
 * @param input Filters and pagination limits
 * @returns A promise resolving to the list of items and total count
 */
export async function fetchReviewQueue(input: FetchQueueInput): Promise<FetchQueueOutput> {
  await delay(MOCK_NETWORK_DELAY_MS);

  let filteredItems = localStore;

  if (input.filters) {
    if (input.filters.status) {
      filteredItems = filteredItems.filter((item) => item.status === input.filters!.status);
    }
    if (input.filters.minRiskScore !== undefined) {
      filteredItems = filteredItems.filter(
        (item) => item.riskScore >= input.filters!.minRiskScore!,
      );
    }
  }

  // Handle simple pagination limits
  const offset = input.offset || 0;
  const limit = input.limit || 50;
  const paginatedItems = filteredItems.slice(offset, offset + limit);

  return {
    items: paginatedItems,
    totalCount: filteredItems.length,
  };
}

/**
 * Updates the status of a specific review item.
 * @param input Update details including new status and optional notes
 * @returns A promise resolving to the updated review item
 */
export async function updateReviewItemStatus(input: UpdateReviewStatusInput): Promise<ReviewItem> {
  await delay(MOCK_NETWORK_DELAY_MS);

  const itemIndex = localStore.findIndex((item) => item.id === input.itemId);

  if (itemIndex === -1) {
    throw new Error(`ReviewItem with ID ${input.itemId} not found.`);
  }

  const updatedItem = {
    ...localStore[itemIndex],
    status: input.newStatus,
  };

  // Persist to local in-memory store
  localStore[itemIndex] = updatedItem;

  return updatedItem;
}

/**
 * Utility to reset the local store state for testing purposes
 */
export function resetLocalStore(): void {
  localStore = [...mockQueueItems];
}
