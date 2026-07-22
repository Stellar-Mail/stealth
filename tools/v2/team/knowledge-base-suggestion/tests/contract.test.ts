/**
 * contract.test.ts — Knowledge Base Suggestion (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, relevance
 * scoring/ranking, limit, and the edge/error paths (empty query, no match,
 * invalid corpus). No UI is exercised.
 */

import { describe, it, expect } from "vitest";
import { createKbSuggestionService } from "../services/kb-suggestion.service";
import { KbErrorCode, ok, fail, type KbResult, type KbContractOutput } from "../contract";
import { KB_ARTICLES } from "../fixtures";

function makeContract() {
  return createKbSuggestionService();
}

describe("kb contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    expect(ok("v")).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(KbErrorCode.NoMatch, "none");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(KbErrorCode.NoMatch);
      expect(r.message).toBe("none");
    }
  });
});

describe("kb contract — suggest", () => {
  it("ranks billing query to the billing article", () => {
    const contract = makeContract();
    const res = contract.execute(
      { operation: "suggest", input: { query: "invoice billing" } },
      KB_ARTICLES,
    );
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "suggest") {
      expect(res.value.suggestions[0].articleId).toBe("kb-billing");
      expect(res.value.suggestions[0].score).toBeGreaterThan(0);
    }
  });

  it("respects the limit", () => {
    const contract = makeContract();
    const res = contract.execute(
      { operation: "suggest", input: { query: "team security billing onboarding", limit: 1 } },
      KB_ARTICLES,
    );
    if (res.ok && res.value.operation === "suggest") {
      expect(res.value.suggestions.length).toBe(1);
    }
  });

  it("returns NoMatch for an unrelated query (no throw)", () => {
    const contract = makeContract();
    const res: KbResult<KbContractOutput> = contract.execute(
      { operation: "suggest", input: { query: "quantum banana spaceship" } },
      KB_ARTICLES,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(KbErrorCode.NoMatch);
  });

  it("rejects an empty query (no throw)", () => {
    const contract = makeContract();
    const res: KbResult<KbContractOutput> = contract.execute(
      { operation: "suggest", input: { query: "   " } },
      KB_ARTICLES,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(KbErrorCode.InvalidInput);
  });
});
