import { describe, expect, it } from "vitest";

import { API_ERROR_CODES, API_ERROR_REGISTRY, ApiError } from "../../../src/server/api/errors";
import { openApiDocument } from "../../../src/server/api/openapi";

describe("API error registry", () => {
  it("contains unique stable codes with exactly one HTTP status each", () => {
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
    for (const code of API_ERROR_CODES) {
      const definition = API_ERROR_REGISTRY[code];
      expect(Number.isInteger(definition.status)).toBe(true);
      expect(definition.status).toBeGreaterThanOrEqual(400);
      expect(definition.status).toBeLessThan(600);
    }
  });

  it.each([
    ["expired_challenge", 422],
    ["challenge_not_yet_valid", 422],
    ["idempotency_mismatch", 409],
    ["invalid_state_transition", 409],
    ["insufficient_postage", 422],
    ["duplicate_receipt", 409],
  ] as const)("constructs %s from its registered defaults", (code, status) => {
    const error = new ApiError(code);
    expect(error).toMatchObject({ code, status, message: API_ERROR_REGISTRY[code].message });
  });

  it("does not allow route and server handlers to use unregistered error codes", () => {
    const files = Object.entries(
      import.meta.glob("/src/{routes,server}/**/*.ts", {
        query: "?raw",
        import: "default",
        eager: true,
      }),
    );
    const usedCodes = files.flatMap(([, source]) =>
      [...String(source).matchAll(/new ApiError\(\s*\d+\s*,\s*["']([a-z_]+)["']/g)].map(
        (match) => match[1],
      ),
    );
    expect(usedCodes.length).toBeGreaterThan(0);
    expect(usedCodes.filter((code) => !API_ERROR_CODES.includes(code as never))).toEqual([]);
  });

  it("exposes every registry code and its metadata through OpenAPI", () => {
    expect(
      openApiDocument.components.schemas.ErrorEnvelope.properties.error.properties.code.enum,
    ).toEqual(API_ERROR_CODES);
    expect(openApiDocument.components.schemas.ApiErrorRegistry["x-error-registry"]).toEqual(
      API_ERROR_REGISTRY,
    );
  });
});
