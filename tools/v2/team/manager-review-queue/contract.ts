/**
 * contract.ts — Manager Review Queue
 *
 * Implements the non-UI execution contract.
 *
 * NOTE ON CHANGES:
 * This file was previously populated with a duplicate copy of the vitest test suite,
 * which caused circular import errors and failed to export the contract methods,
 * enums, and types. We have replaced it with the actual execution contract logic.
 */

import type {
  ReviewItem,
  FetchQueueInput,
  FetchQueueOutput,
  UpdateReviewStatusInput,
} from "./types";

export enum ReviewErrorCode {
  InvalidInput = "INVALID_INPUT",
  ItemNotFound = "ITEM_NOT_FOUND",
  InvalidTransition = "INVALID_TRANSITION",
}

export type ReviewResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ReviewErrorCode; message: string };

export type ReviewOperation =
  | { operation: "fetch"; input: FetchQueueInput }
  | { operation: "updateStatus"; input: UpdateReviewStatusInput };

export type ReviewContractOutput =
  | { operation: "fetch"; result: FetchQueueOutput }
  | { operation: "updateStatus"; item: ReviewItem };

export interface ReviewContract {
  execute(op: ReviewOperation): Promise<ReviewResult<ReviewContractOutput>>;
}

export const MAX_QUEUE_SIZE = 200;

export function ok<T>(value: T): ReviewResult<T> {
  return { ok: true, value };
}

export function fail(error: ReviewErrorCode, message: string): ReviewResult<never> {
  return { ok: false, error, message };
}

export function validateFetchInput(input: FetchQueueInput): ReviewResult<FetchQueueInput> {
  if (!input) {
    return fail(ReviewErrorCode.InvalidInput, "Input is required");
  }
  if (input.limit !== undefined) {
    if (typeof input.limit !== "number" || isNaN(input.limit) || input.limit < 0) {
      return fail(ReviewErrorCode.InvalidInput, "Limit must be a non-negative number");
    }
    if (input.limit > MAX_QUEUE_SIZE) {
      return fail(
        ReviewErrorCode.InvalidInput,
        `Limit exceeds maximum queue size of ${MAX_QUEUE_SIZE}`,
      );
    }
  }
  if (input.offset !== undefined) {
    if (typeof input.offset !== "number" || isNaN(input.offset) || input.offset < 0) {
      return fail(ReviewErrorCode.InvalidInput, "Offset must be a non-negative number");
    }
  }
  return ok(input);
}

export function validateUpdateStatusInput(
  input: UpdateReviewStatusInput,
): ReviewResult<UpdateReviewStatusInput> {
  if (!input) {
    return fail(ReviewErrorCode.InvalidInput, "Input is required");
  }
  if (!input.itemId || typeof input.itemId !== "string" || input.itemId.trim() === "") {
    return fail(ReviewErrorCode.InvalidInput, "itemId must be a non-empty string");
  }
  const allowedStatuses = ["pending", "approved", "rejected", "escalated"];
  if (!input.newStatus || !allowedStatuses.includes(input.newStatus)) {
    return fail(
      ReviewErrorCode.InvalidInput,
      `newStatus must be one of: ${allowedStatuses.join(", ")}`,
    );
  }
  return ok(input);
}

export function applyReviewOperation(
  store: Map<string, ReviewItem>,
  op: ReviewOperation,
): ReviewResult<ReviewContractOutput> {
  if (op.operation === "fetch") {
    const valRes = validateFetchInput(op.input);
    if (!valRes.ok) {
      return valRes;
    }
    const input = valRes.value;

    let items = Array.from(store.values());

    // Apply filters
    if (input.filters) {
      if (input.filters.status) {
        items = items.filter((item) => item.status === input.filters!.status);
      }
      if (input.filters.minRiskScore !== undefined) {
        items = items.filter((item) => item.riskScore >= input.filters!.minRiskScore!);
      }
    }

    const totalCount = items.length;
    const offset = input.offset || 0;
    const limit = input.limit !== undefined ? input.limit : 50;
    const paginatedItems = items.slice(offset, offset + limit);

    return ok({
      operation: "fetch",
      result: {
        items: paginatedItems,
        totalCount,
      },
    });
  } else if (op.operation === "updateStatus") {
    const valRes = validateUpdateStatusInput(op.input);
    if (!valRes.ok) {
      return valRes;
    }
    const input = valRes.value;

    const item = store.get(input.itemId);
    if (!item) {
      return fail(ReviewErrorCode.ItemNotFound, `ReviewItem with ID ${input.itemId} not found`);
    }

    if (item.status === "approved" || item.status === "rejected") {
      return fail(
        ReviewErrorCode.InvalidTransition,
        `Cannot change status of item in terminal state: ${item.status}`,
      );
    }

    // Update item status in store
    const updatedItem: ReviewItem = {
      ...item,
      status: input.newStatus,
    };
    store.set(input.itemId, updatedItem);

    return ok({
      operation: "updateStatus",
      item: updatedItem,
    });
  } else {
    return fail(ReviewErrorCode.InvalidInput, "Unknown operation");
  }
}
