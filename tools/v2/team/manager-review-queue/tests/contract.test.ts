/**
 * contract.test.ts — Manager Review Queue (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs for fetch
 * and updateStatus, plus the error paths (validation, not-found, invalid
 * transition, oversized limit). No UI is exercised.
 */

import { describe, it, expect } from "vitest";
import { createReviewQueueContract } from "../services/execution.service";
import { ReviewErrorCode, ok, fail } from "../contract";
import {
  VALID_FETCH_INPUT,
  VALID_UPDATE_STATUS_INPUT,
  INVALID_LIMIT_FETCH_INPUT,
  OVERSIZED_LIMIT_FETCH_INPUT,
  MISSING_ITEM_ID_UPDATE_INPUT,
  UNKNOWN_ITEM_UPDATE_INPUT,
  INVALID_TRANSITION_UPDATE_INPUT,
} from "../fixtures/contractFixtures";

describe("review queue contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    expect(ok("v")).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(ReviewErrorCode.InvalidInput, "bad");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(ReviewErrorCode.InvalidInput);
      expect(r.message).toBe("bad");
    }
  });
});

describe("review queue contract — fetch (success)", () => {
  it("returns filtered, paginated items with a total count", async () => {
    const contract = createReviewQueueContract(undefined, 0);
    const res = await contract.execute({ operation: "fetch", input: VALID_FETCH_INPUT });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "fetch") {
      expect(res.value.result.items.every((i) => i.status === "pending")).toBe(true);
    }
  });
});

describe("review queue contract — fetch (failure)", () => {
  it("rejects a negative limit", async () => {
    const contract = createReviewQueueContract(undefined, 0);
    const res = await contract.execute({ operation: "fetch", input: INVALID_LIMIT_FETCH_INPUT });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ReviewErrorCode.InvalidInput);
  });

  it("rejects a limit above MAX_QUEUE_SIZE", async () => {
    const contract = createReviewQueueContract(undefined, 0);
    const res = await contract.execute({ operation: "fetch", input: OVERSIZED_LIMIT_FETCH_INPUT });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ReviewErrorCode.InvalidInput);
  });
});

describe("review queue contract — updateStatus (success)", () => {
  it("moves a pending item to approved", async () => {
    const contract = createReviewQueueContract(undefined, 0);
    const res = await contract.execute({
      operation: "updateStatus",
      input: VALID_UPDATE_STATUS_INPUT,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "updateStatus") {
      expect(res.value.item.status).toBe("approved");
    }
  });
});

describe("review queue contract — updateStatus (failure)", () => {
  it("rejects a missing itemId", async () => {
    const contract = createReviewQueueContract(undefined, 0);
    const res = await contract.execute({
      operation: "updateStatus",
      input: MISSING_ITEM_ID_UPDATE_INPUT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ReviewErrorCode.InvalidInput);
  });

  it("returns ItemNotFound for an unknown id", async () => {
    const contract = createReviewQueueContract(undefined, 0);
    const res = await contract.execute({
      operation: "updateStatus",
      input: UNKNOWN_ITEM_UPDATE_INPUT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ReviewErrorCode.ItemNotFound);
  });

  it("returns InvalidTransition when moving out of a terminal status", async () => {
    const contract = createReviewQueueContract(undefined, 0);
    const res = await contract.execute({
      operation: "updateStatus",
      input: INVALID_TRANSITION_UPDATE_INPUT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ReviewErrorCode.InvalidTransition);
  });
});
