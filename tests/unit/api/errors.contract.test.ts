import { describe, expect, it } from "vitest";
import { z } from "zod";

import { normalizeApiError } from "../../../src/server/api/errors";
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

  it("documents the stable validation details schema in OpenAPI", () => {
    expect(openApiDocument.components.schemas.ValidationErrorDetails).toMatchObject({
      type: "object",
      required: ["validationErrors"],
    });
    expect(JSON.stringify(openApiDocument)).toContain("ValidationErrorItem");
  });
});
