import { describe, expect, it } from "vitest";

import { openApiDocument } from "../../../src/server/api/openapi";

// Issue #1529: deprecated operations must be marked in OpenAPI with sunset
// metadata so clients get predictable removal notice.
describe("OpenAPI deprecation metadata", () => {
  const operations: { path: string; op: Record<string, unknown> }[] = [];
  for (const [path, ops] of Object.entries(openApiDocument.paths)) {
    for (const op of Object.values(ops as Record<string, Record<string, unknown>>)) {
      operations.push({ path, op });
    }
  }

  const deprecated = operations.filter((o) => o.op.deprecated === true);

  it("marks at least one operation as deprecated", () => {
    expect(deprecated.length).toBeGreaterThan(0);
  });

  it("every deprecated operation carries sunset metadata", () => {
    for (const { path, op } of deprecated) {
      const meta = op["x-deprecation"] as
        | { reason?: string; sunset?: string; migration?: string }
        | undefined;
      expect(meta, `${path} x-deprecation`).toBeDefined();
      expect(meta?.reason, `${path} deprecation reason`).toBeTruthy();
      expect(meta?.sunset, `${path} sunset date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(meta?.migration, `${path} migration target`).toBeTruthy();
    }
  });

  it("deprecated operations are flagged with x-stability=deprecated", () => {
    for (const { path, op } of deprecated) {
      expect(op["x-stability"], `${path} stability`).toBe("deprecated");
    }
  });
});
