import type { FetchQueueInput, UpdateReviewStatusInput } from "../types";

// --- Success cases ---------------------------------------------------------

export const VALID_FETCH_INPUT: FetchQueueInput = {
  filters: { status: "pending" },
  limit: 10,
  offset: 0,
};

export const VALID_UPDATE_STATUS_INPUT: UpdateReviewStatusInput = {
  itemId: "rev_001", // pending -> approved is an allowed transition
  newStatus: "approved",
  reviewerNotes: "Confirmed with finance, wire is legitimate.",
};

// --- Failure cases -----------------------------------------------------------

export const INVALID_LIMIT_FETCH_INPUT: FetchQueueInput = {
  limit: -5,
};

export const OVERSIZED_LIMIT_FETCH_INPUT: FetchQueueInput = {
  limit: 500, // exceeds MAX_QUEUE_SIZE
};

export const MISSING_ITEM_ID_UPDATE_INPUT = {
  itemId: "",
  newStatus: "approved",
} as UpdateReviewStatusInput;

export const UNKNOWN_ITEM_UPDATE_INPUT: UpdateReviewStatusInput = {
  itemId: "rev_does_not_exist",
  newStatus: "approved",
};

export const INVALID_TRANSITION_UPDATE_INPUT: UpdateReviewStatusInput = {
  itemId: "rev_004", // already "approved" — terminal status
  newStatus: "rejected",
};
