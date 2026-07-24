/**
 * contract.test.ts — Team Workload Balancer (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, delegation to
 * the existing balanceWorkload, and the edge/error paths. No UI is exercised.
 * Uses deterministic strategies (round-robin / least-loaded) to avoid the
 * capacity-weighted random path.
 */

import { describe, it, expect } from "vitest";
import { createWorkloadContract } from "../contract";
import {
  WorkloadErrorCode,
  ok,
  fail,
  type WorkloadResult,
  type WorkloadContractOutput,
} from "../contract";
import { SAMPLE_MEMBERS, SAMPLE_UNASSIGNED, SAMPLE_ALL_ITEMS } from "../contract.fixtures";

describe("workload contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    const r = ok("v");
    expect(r).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(WorkloadErrorCode.InvalidInput, "bad");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(WorkloadErrorCode.InvalidInput);
      expect(r.message).toBe("bad");
    }
  });
});

describe("workload contract — balance", () => {
  it("delegates to balanceWorkload and returns assignments + metrics", () => {
    const contract = createWorkloadContract();
    const res = contract.execute({
      operation: "balance",
      unassignedItems: SAMPLE_UNASSIGNED,
      members: SAMPLE_MEMBERS,
      allItems: SAMPLE_ALL_ITEMS,
      config: { strategy: "least-loaded", prioritizeBy: null, considerSkills: false },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "balance") {
      expect(res.value.result.assignments.length).toBe(2);
      expect(res.value.result.metrics.members.length).toBe(3);
      expect(res.value.result.assignments.every((a) => a.suggestedMemberId)).toBe(true);
    }
  });

  it("uses round-robin deterministically", () => {
    const contract = createWorkloadContract();
    const res = contract.execute({
      operation: "balance",
      unassignedItems: SAMPLE_UNASSIGNED,
      members: SAMPLE_MEMBERS,
      allItems: SAMPLE_ALL_ITEMS,
      config: { strategy: "round-robin", prioritizeBy: null, considerSkills: false },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "balance") {
      expect(res.value.result.assignments.length).toBe(2);
    }
  });

  it("rejects missing members (no throw)", () => {
    const contract = createWorkloadContract();
    const res: WorkloadResult<WorkloadContractOutput> = contract.execute({
      operation: "balance",
      unassignedItems: SAMPLE_UNASSIGNED,
      members: undefined as never,
      allItems: SAMPLE_ALL_ITEMS,
      config: { strategy: "least-loaded", prioritizeBy: null, considerSkills: false },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(WorkloadErrorCode.InvalidInput);
  });

  it("rejects a missing config (no throw)", () => {
    const contract = createWorkloadContract();
    const res: WorkloadResult<WorkloadContractOutput> = contract.execute({
      operation: "balance",
      unassignedItems: SAMPLE_UNASSIGNED,
      members: SAMPLE_MEMBERS,
      allItems: SAMPLE_ALL_ITEMS,
      config: undefined as never,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(WorkloadErrorCode.InvalidInput);
  });
});
