/**
 * contract.test.ts — Team Digest Generator (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, aggregation
 * correctness, and the edge/error paths (empty input, invalid items). No UI is
 * exercised.
 */

import { describe, it, expect } from "vitest";
import { createDigestContract } from "../contract";
import {
  DigestErrorCode,
  ok,
  fail,
  type DigestResult,
  type DigestContractOutput,
} from "../contract";
import { DIGEST_FIXTURES, EMPTY_ITEMS } from "../contract.fixtures";

describe("digest contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    const r = ok("v");
    expect(r).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(DigestErrorCode.InvalidInput, "bad");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(DigestErrorCode.InvalidInput);
      expect(r.message).toBe("bad");
    }
  });
});

describe("digest contract — generate", () => {
  it("aggregates counts and action items from input", () => {
    const contract = createDigestContract();
    const res = contract.execute({ operation: "generate", items: DIGEST_FIXTURES });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "generate") {
      const s = res.value.summary;
      expect(s.totalItems).toBe(4);
      expect(s.authors).toEqual({ Ada: 2, Grace: 2 });
      expect(s.actionItems.length).toBe(2);
      expect(s.topSubjects.length).toBeGreaterThan(0);
    }
  });

  it("honors topSubjectLimit option", () => {
    const contract = createDigestContract();
    const res = contract.execute({
      operation: "generate",
      items: DIGEST_FIXTURES,
      options: { topSubjectLimit: 2 },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "generate") {
      expect(res.value.summary.topSubjects.length).toBeLessThanOrEqual(2);
    }
  });

  it("returns an empty summary for empty input (no throw)", () => {
    const contract = createDigestContract();
    const res = contract.execute({ operation: "generate", items: EMPTY_ITEMS });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "generate") {
      expect(res.value.summary.totalItems).toBe(0);
      expect(res.value.summary.authors).toEqual({});
    }
  });

  it("rejects items missing an author (no throw)", () => {
    const contract = createDigestContract();
    const res: DigestResult<DigestContractOutput> = contract.execute({
      operation: "generate",
      items: [{ id: "x", author: "", subject: "s" } as never],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(DigestErrorCode.InvalidInput);
  });
});
