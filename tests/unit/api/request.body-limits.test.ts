import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  BODY_LIMIT_CATEGORIES,
  ROUTE_BODY_LIMITS,
  parseJsonBody,
  resolveBodyLimit,
  type BodyLimitCategory,
} from "../../../src/server/api/request";
import { openApiDocument } from "../../../src/server/api/openapi";

const schema = z.object({ value: z.string() });

function jsonRequest(body: string, contentLength?: number) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (contentLength !== undefined) headers["content-length"] = String(contentLength);
  return new Request("https://stealth.test/api", { method: "POST", headers, body });
}

describe("body-limit registry (#1487)", () => {
  it("declares a default category and applies it when no selector is given", async () => {
    expect(BODY_LIMIT_CATEGORIES.default).toBeGreaterThan(0);
    expect(resolveBodyLimit()).toBe(BODY_LIMIT_CATEGORIES.default);
  });

  it("every configured category resolves to a finite positive byte cap", () => {
    const categories = Object.keys(BODY_LIMIT_CATEGORIES) as BodyLimitCategory[];
    expect(categories.length).toBeGreaterThan(0);
    for (const category of categories) {
      const bytes = resolveBodyLimit(category);
      expect(Number.isFinite(bytes)).toBe(true);
      expect(bytes).toBeGreaterThan(0);
      expect(bytes).toBe(BODY_LIMIT_CATEGORIES[category]);
    }
  });

  it("resolves every configured route key to its category cap", () => {
    for (const [routeKey, category] of Object.entries(ROUTE_BODY_LIMITS)) {
      const bytes = resolveBodyLimit({ route: routeKey as keyof typeof ROUTE_BODY_LIMITS });
      expect(bytes).toBe(BODY_LIMIT_CATEGORIES[category]);
    }
  });

  it("accepts a raw numeric limit for backward compatibility", () => {
    expect(resolveBodyLimit(2048)).toBe(2048);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("rejects a %s numeric limit so enforcement can't be disabled", (_label, value) => {
    expect(() => resolveBodyLimit(value)).toThrowError(TypeError);
  });

  it("enforces the selected category cap against the actual body", async () => {
    const oversized = JSON.stringify({ value: "x".repeat(BODY_LIMIT_CATEGORIES.minimal) });
    await expect(parseJsonBody(jsonRequest(oversized), schema, "minimal")).rejects.toMatchObject({
      status: 413,
    });
  });

  it("enforces the route-selected cap against the declared Content-Length", async () => {
    const request = jsonRequest(JSON.stringify({ value: "ok" }), BODY_LIMIT_CATEGORIES.compact + 1);
    await expect(parseJsonBody(request, schema, { route: "POST /postage" })).rejects.toMatchObject({
      status: 413,
    });
  });

  it("accepts a body within the selected category cap", async () => {
    const request = jsonRequest(JSON.stringify({ value: "within-limit" }));
    await expect(parseJsonBody(request, schema, "standard")).resolves.toEqual({
      value: "within-limit",
    });
  });

  it("documents the body limit in OpenAPI for mutating operations", () => {
    const paths = openApiDocument.paths as Record<
      string,
      Record<string, { operationId?: string; "x-max-body-bytes"?: number }>
    >;
    const documented = new Map<string, number>();
    for (const methods of Object.values(paths)) {
      for (const op of Object.values(methods)) {
        if (op.operationId && typeof op["x-max-body-bytes"] === "number") {
          documented.set(op.operationId, op["x-max-body-bytes"]);
        }
      }
    }

    // Every write endpoint that parses a JSON body documents its limit.
    for (const opId of [
      "replaceMailboxPolicy",
      "setSenderOverride",
      "evaluateMailboxPolicy",
      "submitPostageProof",
      "quotePostage",
      "recordDelivery",
    ]) {
      expect(documented.get(opId), `${opId} documents x-max-body-bytes`).toBeGreaterThan(0);
    }
  });
});
