import { describe, expect, it } from "vitest";

import { openApiDocument } from "../../../src/server/api/openapi";

// Issue #1527: every OpenAPI operation must have a unique, stable operationId.
describe("OpenAPI operation IDs", () => {
  const operations: { path: string; method: string; operationId?: string; stability?: string }[] =
    [];
  for (const [path, ops] of Object.entries(openApiDocument.paths)) {
    for (const [method, op] of Object.entries(ops as Record<string, Record<string, unknown>>)) {
      const o = op as { operationId?: string; "x-stability"?: string };
      operations.push({ path, method, operationId: o.operationId, stability: o["x-stability"] });
    }
  }

  it("every operation declares an operationId", () => {
    const missing = operations.filter((o) => !o.operationId);
    expect(missing, `operations missing operationId: ${JSON.stringify(missing)}`).toEqual([]);
  });

  it("operationIds are unique", () => {
    const ids = operations.map((o) => o.operationId as string);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every operation declares an explicit stability marker", () => {
    const missing = operations.filter((o) => !o.stability);
    expect(missing, `operations missing x-stability: ${JSON.stringify(missing)}`).toEqual([]);
  });

  it("operationIds follow a semantic verb-noun convention", () => {
    for (const o of operations) {
      expect(o.operationId, `${o.method.toUpperCase()} ${o.path}`).toMatch(
        /^[a-z]+[A-Z][A-Za-z0-9]*$/,
      );
    }
  });
});
