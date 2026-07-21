/**
 * contract.test.ts — Suspicious Sender Watchlist (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, explicit
 * error codes, and the happy/edge paths. No UI is exercised here.
 */

import { describe, it, expect } from "vitest";
import { createWatchlistService } from "../services/watchlist.service";
import { createWatchlistContract } from "../services/execution-contract";
import {
  WatchlistErrorCode,
  ok,
  fail,
  type WatchlistContractOutput,
  type WatchlistResult,
} from "../contract";
import { VALID_ADD_INPUT, VALID_UPDATE_RISK_INPUT } from "../fixtures/contract.fixtures";

function makeContract() {
  const service = createWatchlistService();
  return createWatchlistContract(service);
}

describe("watchlist execution contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    const r = ok(42);
    expect(r).toEqual({ ok: true, value: 42 });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(WatchlistErrorCode.EntryNotFound, "missing");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(WatchlistErrorCode.EntryNotFound);
      expect(r.message).toBe("missing");
    }
  });
});

describe("watchlist execution contract — operations", () => {
  it("list returns seeded entries (ok=true)", async () => {
    const contract = makeContract();
    const res = await contract.execute({ operation: "list" });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "list") {
      expect(Array.isArray(res.value.entries)).toBe(true);
      expect(res.value.entries.length).toBeGreaterThan(0);
    }
  });

  it("list with riskLevel filter narrows to high-risk entries", async () => {
    const contract = makeContract();
    const res = await contract.execute({ operation: "list", filter: { riskLevel: "high" } });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "list") {
      // Every returned entry must be high-risk (the filter is honored).
      expect(res.value.entries.length).toBeGreaterThan(0);
      expect(res.value.entries.every((e) => e.riskLevel === "high")).toBe(true);
    }
  });

  it("add returns a new entry with a generated id and active status", async () => {
    const contract = makeContract();
    const res = await contract.execute({ operation: "add", input: VALID_ADD_INPUT });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "add") {
      expect(res.value.entry.id).toMatch(/^watch-\d{3}$/);
      expect(res.value.entry.status).toBe("active");
      expect(res.value.entry.riskLevel).toBe("high");
    }
  });

  it("updateRisk changes the risk level of an existing entry", async () => {
    const contract = makeContract();
    const res = await contract.execute({
      operation: "updateRisk",
      input: VALID_UPDATE_RISK_INPUT,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "updateRisk") {
      expect(res.value.entry.id).toBe("watch-001");
      expect(res.value.entry.riskLevel).toBe("medium");
    }
  });

  it("dismiss marks an entry dismissed (ok=true)", async () => {
    const contract = makeContract();
    const res = await contract.execute({ operation: "dismiss", id: "watch-002" });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "dismiss") {
      expect(res.value.entry.status).toBe("dismissed");
    }
  });

  it("remove deletes an entry and reports the removed id", async () => {
    const contract = makeContract();
    const res = await contract.execute({ operation: "remove", id: "watch-003" });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "remove") {
      expect(res.value.removedId).toBe("watch-003");
    }
  });

  it("metrics returns aggregate counts (ok=true)", async () => {
    const contract = makeContract();
    const res = await contract.execute({ operation: "metrics" });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "metrics") {
      expect(res.value.metrics.total).toBeGreaterThan(0);
      expect(res.value.metrics.highRisk).toBeGreaterThan(0);
    }
  });
});

describe("watchlist execution contract — error handling", () => {
  it("dismiss of an unknown id maps to EntryNotFound (no throw)", async () => {
    const contract = makeContract();
    const res: WatchlistResult<WatchlistContractOutput> = await contract.execute({
      operation: "dismiss",
      id: "watch-999",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(WatchlistErrorCode.EntryNotFound);
    }
  });

  it("remove of an unknown id maps to EntryNotFound (no throw)", async () => {
    const contract = makeContract();
    const res: WatchlistResult<WatchlistContractOutput> = await contract.execute({
      operation: "remove",
      id: "watch-999",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(WatchlistErrorCode.EntryNotFound);
    }
  });

  it("simulated backend failure maps to BackendFailure (no throw)", async () => {
    const service = createWatchlistService({ failureRate: 1 });
    const contract = createWatchlistContract(service);
    const res: WatchlistResult<WatchlistContractOutput> = await contract.execute({
      operation: "metrics",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(WatchlistErrorCode.BackendFailure);
    }
  });
});
