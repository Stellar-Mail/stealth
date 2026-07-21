import { describe, expect, it } from "vitest";

import type { ApiErrorCode } from "../../../src/server/api/errors";
import { openApiDocument } from "../../../src/server/api/openapi";

// ---------------------------------------------------------------------------
// Issue #1528 – OpenAPI examples for every domain error family.
//
// Acceptance criteria verified here:
//  1. Each error family has at least one example.
//  2. Examples match the runtime envelope (error.code, error.message, meta.*).
//  3. No sensitive or real user data appears in any example.
//  4. The error code in each example exists in the ApiErrorCode registry.
// ---------------------------------------------------------------------------

/** All valid ApiErrorCode values (mirrors errors.ts — kept in sync manually). */
const VALID_ERROR_CODES = new Set<ApiErrorCode>([
  "bad_request",
  "conflict",
  "forbidden",
  "internal_error",
  "method_not_allowed",
  "not_found",
  "unauthorized",
  "validation_error",
  "too_many_requests",
]);

/** The domain error families that must be covered. */
const REQUIRED_FAMILIES: Record<string, string[]> = {
  auth: ["AuthUnauthorized", "AuthForbidden"],
  validation: ["ValidationBadRequest", "ValidationError"],
  conflict: ["ConflictDuplicate"],
  postage: ["PostageNotFound", "PostageConflict"],
  receipt: ["ReceiptNotFound", "ReceiptConflict"],
  policy: ["PolicyNotFound", "PolicyForbidden"],
  "rate-limit": ["RateLimitExceeded"],
};

// Grab the reusable examples map from the compiled document.
const examples = openApiDocument.components.examples as Record<
  string,
  { summary?: string; value: unknown }
>;

// ---------------------------------------------------------------------------
// Helper: assert an object looks like a runtime ErrorEnvelope.
// ---------------------------------------------------------------------------
function assertEnvelopeShape(name: string, value: unknown) {
  expect(value, `${name}: example.value must be an object`).toBeTruthy();
  expect(typeof value, `${name}: example.value must be an object`).toBe("object");

  const v = value as Record<string, unknown>;

  // --- error block ---
  expect(v["error"], `${name}: must have an error block`).toBeTruthy();
  const error = v["error"] as Record<string, unknown>;
  expect(typeof error["code"], `${name}: error.code must be a string`).toBe("string");
  expect(typeof error["message"], `${name}: error.message must be a string`).toBe("string");
  expect(error["message"], `${name}: error.message must not be empty`).toBeTruthy();

  // --- meta block ---
  expect(v["meta"], `${name}: must have a meta block`).toBeTruthy();
  const meta = v["meta"] as Record<string, unknown>;
  expect(typeof meta["requestId"], `${name}: meta.requestId must be a string`).toBe("string");
  expect(typeof meta["timestamp"], `${name}: meta.timestamp must be a string`).toBe("string");
}

// ---------------------------------------------------------------------------
// Helper: assert no sensitive/real user data is embedded.
// Checks for Stellar addresses, SHA-256 hashes, and email-like patterns.
// ---------------------------------------------------------------------------
function assertNoRealUserData(name: string, value: unknown) {
  const serialized = JSON.stringify(value);

  // Real Stellar G-addresses (55-char base32 after the G)
  expect(serialized, `${name}: must not contain a real Stellar address`).not.toMatch(
    /G[A-Z2-7]{55}/,
  );

  // Real 32-byte hex hashes
  expect(serialized, `${name}: must not contain a real hash`).not.toMatch(/[a-f0-9]{64}/);

  // Email addresses
  expect(serialized, `${name}: must not contain an email address`).not.toMatch(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpenAPI domain error examples (issue #1528)", () => {
  it("components.examples exists and is non-empty", () => {
    expect(examples).toBeTruthy();
    expect(Object.keys(examples).length).toBeGreaterThan(0);
  });

  describe("required domain families", () => {
    for (const [family, keys] of Object.entries(REQUIRED_FAMILIES)) {
      it(`family "${family}" has at least one example`, () => {
        for (const key of keys) {
          expect(
            examples[key],
            `components.examples.${key} must exist for family "${family}"`,
          ).toBeDefined();
        }
      });
    }
  });

  describe("every example matches the runtime ErrorEnvelope shape", () => {
    for (const [name, example] of Object.entries(examples)) {
      it(`${name} has a valid envelope shape`, () => {
        assertEnvelopeShape(name, example.value);
      });
    }
  });

  describe("every example error code exists in the ApiErrorCode registry", () => {
    for (const [name, example] of Object.entries(examples)) {
      it(`${name} uses a registered error code`, () => {
        const v = example.value as Record<string, unknown>;
        const error = v["error"] as Record<string, unknown>;
        const code = error["code"] as string;
        expect(
          VALID_ERROR_CODES.has(code as ApiErrorCode),
          `"${code}" is not a valid ApiErrorCode (in ${name})`,
        ).toBe(true);
      });
    }
  });

  describe("no real user data in any example", () => {
    for (const [name, example] of Object.entries(examples)) {
      it(`${name} contains no sensitive or real user data`, () => {
        assertNoRealUserData(name, example.value);
      });
    }
  });

  describe("every example has a human-readable summary", () => {
    for (const [name, example] of Object.entries(examples)) {
      it(`${name} has a non-empty summary`, () => {
        expect(example.summary, `${name}: summary should be defined`).toBeTruthy();
      });
    }
  });

  describe("ErrorEnvelope schema is declared in components.schemas", () => {
    it("ErrorEnvelope schema exists", () => {
      expect(
        (openApiDocument.components.schemas as Record<string, unknown>)["ErrorEnvelope"],
      ).toBeDefined();
    });
  });

  describe("path operations reference error examples via $ref", () => {
    it("at least one path operation wires error response examples", () => {
      const docString = JSON.stringify(openApiDocument.paths);
      // Look for at least one reference to the components/examples namespace.
      expect(docString).toContain("#/components/examples/");
    });

    it("every $ref in examples resolves to a defined component example", () => {
      const docString = JSON.stringify(openApiDocument.paths);
      const refs = [...docString.matchAll(/#\/components\/examples\/([A-Za-z0-9_]+)/g)].map(
        (m) => m[1],
      );
      expect(refs.length, "must find at least one example $ref in paths").toBeGreaterThan(0);
      for (const ref of refs) {
        expect(examples[ref], `components.examples.${ref} must be defined`).toBeDefined();
      }
    });
  });

  describe("error response status codes", () => {
    const paths = openApiDocument.paths as Record<
      string,
      Record<string, { responses?: Record<string, unknown> }>
    >;

    it("every auth-secured operation documents 401 and/or 403", () => {
      for (const [path, ops] of Object.entries(paths)) {
        for (const [method, op] of Object.entries(ops)) {
          const secured = (op as { security?: unknown }).security !== undefined;
          if (!secured) continue;
          const responseCodes = Object.keys(op.responses ?? {});
          const hasAuthError = responseCodes.includes("401") || responseCodes.includes("403");
          expect(
            hasAuthError,
            `${method.toUpperCase()} ${path} must document 401 or 403 as it is security-scoped`,
          ).toBe(true);
        }
      }
    });

    it("every mutating operation documents 429", () => {
      const mutating = new Set(["post", "put", "delete", "patch"]);
      for (const [path, ops] of Object.entries(paths)) {
        for (const [method, op] of Object.entries(ops)) {
          if (!mutating.has(method)) continue;
          const responseCodes = Object.keys(op.responses ?? {});
          expect(
            responseCodes.includes("429"),
            `${method.toUpperCase()} ${path} must document 429`,
          ).toBe(true);
        }
      }
    });
  });
});
