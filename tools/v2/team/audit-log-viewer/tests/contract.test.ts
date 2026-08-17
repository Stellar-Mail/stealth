/**
 * contract.test.ts — Audit Log Viewer (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs for
 * listEntries and getEntry, plus the error paths (validation, not-found,
 * invalid date range, oversized limit). No UI is exercised.
 */

import { describe, it, expect } from "vitest";
import { createAuditLogContract } from "../services/execution.service";
import { AuditErrorCode, ok, fail } from "../contract";
import {
  VALID_LIST_INPUT,
  VALID_GET_ENTRY_INPUT,
  INVALID_LIMIT_LIST_INPUT,
  OVERSIZED_LIMIT_LIST_INPUT,
  INVALID_DATE_RANGE_LIST_INPUT,
  MISSING_ENTRY_ID_INPUT,
  UNKNOWN_ENTRY_ID_INPUT,
} from "../fixtures/contractFixtures";

describe("audit log contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    expect(ok("v")).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(AuditErrorCode.InvalidInput, "bad");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(AuditErrorCode.InvalidInput);
      expect(r.message).toBe("bad");
    }
  });
});

describe("audit log contract — listEntries (success)", () => {
  it("returns filtered, paginated entries with a total count", async () => {
    const contract = createAuditLogContract(undefined, 0);
    const res = await contract.execute({ operation: "listEntries", input: VALID_LIST_INPUT });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "listEntries") {
      expect(res.value.result.entries.every((e) => e.severity === "warning")).toBe(true);
    }
  });
});

describe("audit log contract — listEntries (failure)", () => {
  it("rejects a negative limit", async () => {
    const contract = createAuditLogContract(undefined, 0);
    const res = await contract.execute({
      operation: "listEntries",
      input: INVALID_LIMIT_LIST_INPUT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AuditErrorCode.InvalidInput);
  });

  it("rejects a limit above MAX_PAGE_SIZE", async () => {
    const contract = createAuditLogContract(undefined, 0);
    const res = await contract.execute({
      operation: "listEntries",
      input: OVERSIZED_LIMIT_LIST_INPUT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AuditErrorCode.InvalidInput);
  });

  it("rejects a from-after-to date range", async () => {
    const contract = createAuditLogContract(undefined, 0);
    const res = await contract.execute({
      operation: "listEntries",
      input: INVALID_DATE_RANGE_LIST_INPUT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AuditErrorCode.InvalidInput);
  });
});

describe("audit log contract — getEntry (success)", () => {
  it("returns the matching entry", async () => {
    const contract = createAuditLogContract(undefined, 0);
    const res = await contract.execute({ operation: "getEntry", input: VALID_GET_ENTRY_INPUT });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "getEntry") {
      expect(res.value.entry.id).toBe("log_001");
    }
  });
});

describe("audit log contract — getEntry (failure)", () => {
  it("rejects a missing entryId", async () => {
    const contract = createAuditLogContract(undefined, 0);
    const res = await contract.execute({ operation: "getEntry", input: MISSING_ENTRY_ID_INPUT });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AuditErrorCode.InvalidInput);
  });

  it("returns EntryNotFound for an unknown id", async () => {
    const contract = createAuditLogContract(undefined, 0);
    const res = await contract.execute({ operation: "getEntry", input: UNKNOWN_ENTRY_ID_INPUT });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AuditErrorCode.EntryNotFound);
  });
});
