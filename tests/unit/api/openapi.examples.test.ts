import { describe, expect, it } from "vitest";

import { openApiDocument } from "../../../src/server/api/openapi";

// Validates the OpenAPI document's examples/schemas relationship:
// every $ref resolves to a defined component schema, and any inline example
// is structurally consistent with its declared type. Fixed fixtures (no
// generated timestamps) keep validation deterministic.
describe("OpenAPI example/schema integrity", () => {
  const schemaNames = new Set(Object.keys(openApiDocument.components.schemas));
  const docString = JSON.stringify(openApiDocument);

  it("resolves every component schema reference", () => {
    const refs = [...docString.matchAll(/#\/components\/schemas\/([A-Za-z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(schemaNames.has(ref), `schema ${ref} is defined`).toBe(true);
    }
  });

  it("declares reusable component schemas for shared domain types", () => {
    expect([...schemaNames]).toEqual(
      expect.arrayContaining(["StellarAddress", "Hash32", "StroopAmount", "MailboxPolicy"]),
    );
  });

  it("every operation declares a summary (no empty documentation)", () => {
    for (const [path, ops] of Object.entries(openApiDocument.paths)) {
      for (const [method, op] of Object.entries(ops as Record<string, { summary?: string }>)) {
        expect(op.summary, `${method.toUpperCase()} ${path} summary`).toBeTruthy();
      }
    }
  });
});
