/**
 * contract.test.ts — Client Priority Scoring (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, weighted
 * scoring, priority bands, ordering, and edge/error paths. No UI is exercised.
 */

import { describe, it, expect } from "vitest";
import { createPriorityContract } from "../services/client-priority.service";
import {
  PriorityErrorCode,
  ok,
  fail,
  type PriorityResult,
  type PriorityContractOutput,
} from "../contract";
import { PRIORITY_FIXTURES, EMPTY_CLIENTS } from "../fixtures";

describe("priority contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    const r = ok("v");
    expect(r).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(PriorityErrorCode.InvalidInput, "bad");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(PriorityErrorCode.InvalidInput);
      expect(r.message).toBe("bad");
    }
  });
});

describe("priority contract — score", () => {
  it("scores and ranks clients by weighted score (desc default)", () => {
    const contract = createPriorityContract();
    const res = contract.execute({ operation: "score", input: { clients: PRIORITY_FIXTURES } });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "score") {
      const ranked = res.value.ranked;
      expect(ranked.length).toBe(3);
      // Initech (20) > Acme (10) > Globex (3)
      expect(ranked.map((c) => c.id)).toEqual(["client-initech", "client-acme", "client-globex"]);
      const initech = ranked.find((c) => c.id === "client-initech");
      expect(initech?.score).toBe(20);
      expect(initech?.priority).toBe("high");
    }
  });

  it("honors asc ordering when requested", () => {
    const contract = createPriorityContract();
    const res = contract.execute({
      operation: "score",
      input: { clients: PRIORITY_FIXTURES },
      order: "asc",
    });
    if (res.ok && res.value.operation === "score") {
      expect(res.value.ranked.map((c) => c.id)).toEqual([
        "client-globex",
        "client-acme",
        "client-initech",
      ]);
    }
  });

  it("derives priority bands from thresholds", () => {
    const contract = createPriorityContract();
    const res = contract.execute({ operation: "score", input: { clients: PRIORITY_FIXTURES } });
    if (res.ok && res.value.operation === "score") {
      const bands = Object.fromEntries(res.value.ranked.map((c) => [c.id, c.priority]));
      expect(bands["client-initech"]).toBe("high"); // 20 >= 10
      expect(bands["client-acme"]).toBe("high"); // 10 >= 10
      expect(bands["client-globex"]).toBe("medium"); // 3 is not < lowThreshold(3)
    }
  });

  it("returns an empty ranking for no clients (no throw)", () => {
    const contract = createPriorityContract();
    const res = contract.execute({ operation: "score", input: { clients: EMPTY_CLIENTS } });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "score") {
      expect(res.value.ranked).toEqual([]);
    }
  });

  it("rejects a client with a non-numeric signal (no throw)", () => {
    const contract = createPriorityContract();
    const res: PriorityResult<PriorityContractOutput> = contract.execute({
      operation: "score",
      input: {
        clients: [
          { id: "x", name: "X", signals: [{ name: "revenue", value: NaN, weight: 1 }] } as never,
        ],
      },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(PriorityErrorCode.InvalidInput);
  });
});
