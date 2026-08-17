/**
 * contract.test.ts — Docs (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, resolve by id
 * and by path, and the edge/error paths (unknown ref, empty ref, invalid
 * index). No UI is exercised.
 */

import { describe, it, expect } from "vitest";
import { createDocsService } from "../services/docs.service";
import { DocErrorCode, ok, fail, type DocResult, type DocContractOutput } from "../contract";
import { DOC_INDEX } from "../fixtures";

function makeContract() {
  return createDocsService();
}

describe("docs contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    expect(ok("v")).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(DocErrorCode.DocNotFound, "missing");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(DocErrorCode.DocNotFound);
      expect(r.message).toBe("missing");
    }
  });
});

describe("docs contract — resolve", () => {
  it("resolves a doc by id", () => {
    const contract = makeContract();
    const res = contract.execute(
      { operation: "resolve", input: { ref: "doc-api-reference" } },
      DOC_INDEX,
    );
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "resolve") {
      expect(res.value.doc.id).toBe("doc-api-reference");
      expect(res.value.doc.path).toBe("docs/api/reference.md");
    }
  });

  it("resolves a doc by path", () => {
    const contract = makeContract();
    const res = contract.execute(
      { operation: "resolve", input: { ref: "docs/CONTRIBUTING.md" } },
      DOC_INDEX,
    );
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "resolve") {
      expect(res.value.doc.id).toBe("doc-contributing");
    }
  });

  it("returns DocNotFound for an unknown ref (no throw)", () => {
    const contract = makeContract();
    const res: DocResult<DocContractOutput> = contract.execute(
      { operation: "resolve", input: { ref: "doc-nope" } },
      DOC_INDEX,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(DocErrorCode.DocNotFound);
  });

  it("rejects an empty ref (no throw)", () => {
    const contract = makeContract();
    const res: DocResult<DocContractOutput> = contract.execute(
      { operation: "resolve", input: { ref: "   " } },
      DOC_INDEX,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(DocErrorCode.InvalidInput);
  });
});
