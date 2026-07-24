import { describe, expect, it } from "vitest";

import { openApiDocument } from "../../../src/server/api/openapi";

describe("OpenAPI document", () => {
  it("publishes every v1 endpoint family", () => {
    expect(Object.keys(openApiDocument.paths)).toEqual(
      expect.arrayContaining([
        "/health",
        "/policies/{owner}",
        "/policies/evaluate",
        "/postage",
        "/postage/{messageId}/settle",
        "/receipts",
        "/receipts/{messageId}/read",
      ]),
    );
  });

  it("documents the SEP-10 signed-request authentication flow", () => {
    expect(openApiDocument.components.securitySchemes.StellarSignedRequest).toMatchObject({
      type: "http",
      scheme: "bearer",
      bearerFormat: "SEP-10 JWT",
      "x-required-headers": ["Authorization"],
    });
  });

  it("requires signed requests on protected operations", () => {
    expect(openApiDocument.paths["/policies/{owner}"].put.security).toEqual([
      { StellarSignedRequest: [] },
    ]);
    expect(openApiDocument.paths["/postage/{messageId}"].get.security).toEqual([
      { StellarSignedRequest: [] },
    ]);
  });

  it("does not require authentication on public operations", () => {
    expect(openApiDocument.paths["/health"].get).not.toHaveProperty("security");
    expect(openApiDocument.paths["/policies/{owner}"].get).not.toHaveProperty("security");
    expect(openApiDocument.paths["/postage/quote"].post).not.toHaveProperty("security");
  });

  it("preserves the backwards-compatible default response on every operation", () => {
    for (const path of Object.values(openApiDocument.paths)) {
      for (const operation of Object.values(path)) {
        expect(operation.responses).toHaveProperty("default");
      }
    }
  });
});
