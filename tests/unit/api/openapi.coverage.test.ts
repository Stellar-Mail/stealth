import { describe, expect, it } from "vitest";

import { openApiDocument } from "../../../src/server/api/openapi";

// Enumerate documented OpenAPI operations and verify internal consistency:
// every path/method is present, every operation documents security where the
// codebase requires it, and referenced component schemas exist.
describe("OpenAPI route coverage", () => {
  const paths = openApiDocument.paths;
  const pathKeys = Object.keys(paths);
  const opIds = new Set<string>();

  for (const path of pathKeys) {
    const methods = Object.keys(paths[path as keyof typeof paths]);
    for (const method of methods) {
      const op = (paths[path as keyof typeof paths] as Record<string, { operationId?: string }>)[
        method
      ];
      if (op?.operationId) opIds.add(op.operationId);
    }
  }

  it("declares every expected v1 endpoint family", () => {
    expect(pathKeys).toEqual(
      expect.arrayContaining([
        "/health",
        "/protocol",
        "/openapi.json",
        "/policies/{owner}",
        "/policies/{owner}/senders/{sender}",
        "/policies/evaluate",
        "/postage",
        "/postage/quote",
        "/postage/{messageId}",
        "/postage/{messageId}/settle",
        "/postage/{messageId}/refund",
        "/receipts",
        "/receipts/{messageId}",
        "/receipts/{messageId}/read",
      ]),
    );
  });

  it("documents security on every mutating operation", () => {
    const mutating = new Set(["post", "put", "delete", "patch"]);
    // Read-only decision endpoints that intentionally do not require actor auth.
    const readOnlyPosts = new Set(["/policies/evaluate", "/postage/quote"]);
    for (const path of pathKeys) {
      const methods = Object.keys(paths[path as keyof typeof paths]);
      for (const method of methods) {
        if (!mutating.has(method)) continue;
        if (method === "post" && readOnlyPosts.has(path)) continue;
        const op = (paths[path as keyof typeof paths] as Record<string, { security?: unknown }>)[
          method
        ];
        expect(op.security, `${method.toUpperCase()} ${path} security`).toBeDefined();
      }
    }
  });

  it("every operation has a unique operationId", () => {
    const all = pathKeys.flatMap((path) => {
      const methods = Object.keys(paths[path as keyof typeof paths]);
      return methods
        .map((method) => {
          const op = (
            paths[path as keyof typeof paths] as Record<string, { operationId?: string }>
          )[method];
          return op?.operationId;
        })
        .filter((id): id is string => Boolean(id));
    });
    expect(all.length).toBe(opIds.size);
  });

  it("resolves all component schema $refs", () => {
    const schemaNames = new Set(Object.keys(openApiDocument.components.schemas));
    const docString = JSON.stringify(openApiDocument);
    const refs = [...docString.matchAll(/#\/components\/schemas\/([A-Za-z0-9_]+)/g)].map(
      (m) => m[1],
    );
    for (const ref of refs) {
      expect(schemaNames.has(ref), `schema ${ref} is defined`).toBe(true);
    }
  });
});
