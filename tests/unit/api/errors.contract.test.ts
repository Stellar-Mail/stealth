import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiError, normalizeApiError } from "../../../src/server/api/errors";
import { openApiDocument } from "../../../src/server/api/openapi";

describe("validation error contract", () => {
  it("maps Zod errors into the stable public validation schema without echoing input", () => {
    const schema = z.object({
      recipient: z.string().email(),
      tags: z.array(z.string().min(3)),
    });

    const parsed = schema.safeParse({ recipient: "secret-token", tags: ["no"] });
    expect(parsed.success).toBe(false);

    const apiError = normalizeApiError(parsed.error);

    expect(apiError).toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Request validation failed",
      retryable: false,
      retryClassification: "permanent",
      details: {
        validationErrors: [
          { path: "recipient", rule: "format", message: expect.any(String) },
          { path: "tags[0]", rule: "min_length", message: expect.any(String) },
        ],
      },
    });
    expect(JSON.stringify(apiError.details)).not.toContain("secret-token");
    expect(apiError.details).not.toHaveProperty("fieldErrors");
    expect(apiError.details).not.toHaveProperty("formErrors");
  });

  it("classifies validation errors as permanent and non-retryable", () => {
    const schema = z.string();
    const parsed = schema.safeParse(123);
    const apiError = normalizeApiError(parsed.error);
    expect(apiError.retryable).toBe(false);
    expect(apiError.retryClassification).toBe("permanent");
  });

  it("classifies rate limit errors as rate_limited and retryable, preserving delay", () => {
    const error = normalizeApiError(
      new ApiError(429, "too_many_requests", "Too many requests", { retryAfterSeconds: 15 }),
    );
    expect(error.retryable).toBe(true);
    expect(error.retryClassification).toBe("rate_limit");
    expect(error.retryAfterSeconds).toBe(15);
  });

  it("classifies conflict errors as temporary conflicts and retryable", () => {
    const error = normalizeApiError(new ApiError(409, "conflict", "Conflict occurred"));
    expect(error.retryable).toBe(true);
    expect(error.retryClassification).toBe("conflict");
  });

  it("classifies internal errors as transient and retryable", () => {
    const error = normalizeApiError(new Error("Database disconnected"));
    expect(error.status).toBe(500);
    expect(error.retryable).toBe(true);
    expect(error.retryClassification).toBe("transient");
  });

  it("documents the stable validation details schema in OpenAPI", () => {
    expect(openApiDocument.components.schemas.ValidationErrorDetails).toMatchObject({
      type: "object",
      required: ["validationErrors"],
    });
    expect(JSON.stringify(openApiDocument)).toContain("ValidationErrorItem");
  });

  it("documents the RetryClassification and ErrorEnvelope schemas in OpenAPI", () => {
    expect(openApiDocument.components.schemas.RetryClassification).toMatchObject({
      type: "string",
      enum: expect.arrayContaining(["permanent", "transient", "rate_limit", "conflict"]),
    });

    expect(openApiDocument.components.schemas.ErrorEnvelope).toMatchObject({
      type: "object",
      required: ["error", "meta"],
    });
  });
});
