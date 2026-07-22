/**
 * contract-coverage.test.ts — Manager Review Queue
 *
 * Additional coverage for the non-UI execution contract, complementing
 * contract.test.ts. Exercises fetch filtering/pagination, allowed status
 * transitions, store persistence, the input validators, and the
 * unrecognised-operation path. No UI, network, or database is involved.
 */

import { describe, it, expect } from "vitest";

import { createReviewQueueContract } from "../services/execution.service";
import {
  applyReviewOperation,
  validateFetchInput,
  validateUpdateStatusInput,
  ReviewErrorCode,
  MAX_QUEUE_SIZE,
} from "../contract";
import type { ReviewOperation } from "../contract";
import type { ReviewItem } from "../types";

const seed = (): ReviewItem[] => [
  {
    id: "a1",
    submitterId: "u1",
    contentSnippet: "one",
    submittedAt: "2026-06-18T10:00:00Z",
    status: "pending",
    riskScore: 10,
  },
  {
    id: "a2",
    submitterId: "u2",
    contentSnippet: "two",
    submittedAt: "2026-06-18T11:00:00Z",
    status: "pending",
    riskScore: 80,
  },
  {
    id: "a3",
    submitterId: "u3",
    contentSnippet: "three",
    submittedAt: "2026-06-18T12:00:00Z",
    status: "escalated",
    riskScore: 90,
  },
  {
    id: "a4",
    submitterId: "u4",
    contentSnippet: "four",
    submittedAt: "2026-06-18T13:00:00Z",
    status: "approved",
    riskScore: 30,
  },
];

describe("fetch — filters and pagination", () => {
  it("returns all items when no filters or paging are supplied", async () => {
    const contract = createReviewQueueContract(seed(), 0);
    const res = await contract.execute({ operation: "fetch", input: {} });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "fetch") {
      expect(res.value.result.totalCount).toBe(4);
      expect(res.value.result.items).toHaveLength(4);
    }
  });

  it("applies offset and limit while reporting the full total", async () => {
    const contract = createReviewQueueContract(seed(), 0);
    const res = await contract.execute({
      operation: "fetch",
      input: { offset: 1, limit: 2 },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "fetch") {
      expect(res.value.result.totalCount).toBe(4);
      expect(res.value.result.items.map((i) => i.id)).toEqual(["a2", "a3"]);
    }
  });

  it("filters by minRiskScore", async () => {
    const contract = createReviewQueueContract(seed(), 0);
    const res = await contract.execute({
      operation: "fetch",
      input: { filters: { minRiskScore: 80 } },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "fetch") {
      expect(res.value.result.items.map((i) => i.id)).toEqual(["a2", "a3"]);
    }
  });

  it("rejects a negative offset", async () => {
    const contract = createReviewQueueContract(seed(), 0);
    const res = await contract.execute({ operation: "fetch", input: { offset: -1 } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ReviewErrorCode.InvalidInput);
  });
});

describe("updateStatus — transitions and persistence", () => {
  it("moves a pending item to escalated", async () => {
    const contract = createReviewQueueContract(seed(), 0);
    const res = await contract.execute({
      operation: "updateStatus",
      input: { itemId: "a1", newStatus: "escalated" },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "updateStatus") {
      expect(res.value.item.status).toBe("escalated");
    }
  });

  it("allows moving an escalated item to approved", async () => {
    const contract = createReviewQueueContract(seed(), 0);
    const res = await contract.execute({
      operation: "updateStatus",
      input: { itemId: "a3", newStatus: "approved" },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "updateStatus") {
      expect(res.value.item.status).toBe("approved");
    }
  });

  it("persists the new status in the backing store", async () => {
    const contract = createReviewQueueContract(seed(), 0);
    await contract.execute({
      operation: "updateStatus",
      input: { itemId: "a1", newStatus: "approved" },
    });
    const res = await contract.execute({
      operation: "fetch",
      input: { filters: { status: "approved" } },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "fetch") {
      expect(res.value.result.items.map((i) => i.id)).toContain("a1");
    }
  });

  it("rejects an unknown target status", async () => {
    const contract = createReviewQueueContract(seed(), 0);
    const res = await contract.execute({
      operation: "updateStatus",
      input: { itemId: "a1", newStatus: "archived" as unknown as ReviewItem["status"] },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ReviewErrorCode.InvalidInput);
  });
});

describe("contract primitives", () => {
  it("validateFetchInput accepts a well-formed input", () => {
    const res = validateFetchInput({ limit: 10, offset: 0 });
    expect(res.ok).toBe(true);
  });

  it("validateFetchInput rejects a NaN limit", () => {
    const res = validateFetchInput({ limit: Number.NaN });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ReviewErrorCode.InvalidInput);
  });

  it("validateFetchInput rejects a limit above MAX_QUEUE_SIZE", () => {
    const res = validateFetchInput({ limit: MAX_QUEUE_SIZE + 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ReviewErrorCode.InvalidInput);
  });

  it("validateUpdateStatusInput rejects a whitespace itemId", () => {
    const res = validateUpdateStatusInput({ itemId: "   ", newStatus: "approved" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ReviewErrorCode.InvalidInput);
  });

  it("applyReviewOperation returns InvalidInput for an unrecognised operation", () => {
    const store = new Map<string, ReviewItem>();
    const res = applyReviewOperation(store, { operation: "delete" } as unknown as ReviewOperation);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ReviewErrorCode.InvalidInput);
  });
});
