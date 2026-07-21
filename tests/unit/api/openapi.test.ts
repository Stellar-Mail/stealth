import { describe, expect, it } from "vitest";
import { z } from "zod";

import { mailboxPolicySchema, stellarAddressSchema, stroopAmountSchema } from "../../../src/server/api/domain";
import { openApiDocument, toOpenApiSchema } from "../../../src/server/api/openapi";

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

  it("derives documented schemas from shared runtime Zod definitions", () => {
    expect(openApiDocument.components.schemas.MailboxPolicy).toMatchObject({
      type: "object",
      required: ["allowUnknown", "minimumPostage", "requireVerified"],
      properties: {
        minimumPostage: { $ref: "#/components/schemas/StroopAmount" },
      },
    });

    expect(openApiDocument.components.schemas.StroopAmount).toMatchObject({
      type: "string",
      pattern: "^(0|[1-9]\\d*)$",
    });
  });

  it("converts shared runtime schemas into deterministic OpenAPI schemas", () => {
    const first = JSON.stringify(toOpenApiSchema(mailboxPolicySchema));
    const second = JSON.stringify(toOpenApiSchema(mailboxPolicySchema));

    expect(first).toBe(second);
    expect(toOpenApiSchema(stellarAddressSchema)).toMatchObject({
      type: "string",
      pattern: "^G[A-Z2-7]{55}$",
    });
    expect(toOpenApiSchema(stroopAmountSchema)).toMatchObject({
      type: "string",
      pattern: "^(0|[1-9]\\d*)$",
    });
  });

  it("fails clearly for unsupported Zod constructs", () => {
    expect(() => toOpenApiSchema(z.string().transform((value) => value))).toThrow(
      /Unsupported Zod construct/i,
    );
  });
});
