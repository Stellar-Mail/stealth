import { describe, expect, it } from "vitest";
import * as fs from "fs";

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
      expect.arrayContaining([
        "StellarAddress",
        "Hash32",
        "StroopAmount",
        "MailboxPolicy",
        "PolicyEvaluationRequest",
        "PolicyEvaluationDecision",
      ]),
    );
  });

  it("every operation declares a summary (no empty documentation)", () => {
    for (const [path, ops] of Object.entries(openApiDocument.paths)) {
      for (const [method, op] of Object.entries(ops as Record<string, { summary?: string }>)) {
        expect(op.summary, `${method.toUpperCase()} ${path} summary`).toBeTruthy();
      }
    }
  });

  describe("policy evaluation OpenAPI documentation (#1330)", () => {
    const evalOp = openApiDocument.paths["/policies/evaluate"].post as any;

    it("documents requestBody with PolicyEvaluationRequest schema reference and examples", () => {
      expect(evalOp.requestBody).toBeDefined();

      const jsonContent = evalOp.requestBody.content["application/json"];
      expect(jsonContent.schema.$ref).toBe("#/components/schemas/PolicyEvaluationRequest");
      expect(jsonContent.examples).toHaveProperty("validEvaluation");
      expect(jsonContent.examples).toHaveProperty("malformedAddress");
      expect(jsonContent.examples).toHaveProperty("malformedPostage");
    });

    it("includes policy-denied response examples on HTTP 200", () => {
      const response200 = evalOp.responses["200"].content["application/json"];
      expect(response200.examples).toBeDefined();

      const examples = response200.examples;
      expect(examples).toHaveProperty("policySatisfied");
      expect(examples).toHaveProperty("senderAllowed");
      expect(examples).toHaveProperty("senderBlocked");
      expect(examples).toHaveProperty("unknownSendersDisabled");
      expect(examples).toHaveProperty("insufficientPostage");
      expect(examples).toHaveProperty("verificationRequired");

      // Verify policy denied examples have allowed: false
      expect(examples.senderBlocked.value.data.allowed).toBe(false);
      expect(examples.unknownSendersDisabled.value.data.allowed).toBe(false);
      expect(examples.insufficientPostage.value.data.allowed).toBe(false);
      expect(examples.verificationRequired.value.data.allowed).toBe(false);
    });

    it("includes malformed request validation failure examples on HTTP 422", () => {
      expect(evalOp.responses).toHaveProperty("422");
      const response422 = evalOp.responses["422"].content["application/json"];

      expect(response422.schema.$ref).toBe("#/components/schemas/ErrorEnvelope");
      expect(response422.examples).toHaveProperty("invalidStellarAddress");
      expect(response422.examples).toHaveProperty("invalidPostageAmount");

      expect(response422.examples.invalidStellarAddress.value.error.code).toBe("validation_error");
      expect(response422.examples.invalidPostageAmount.value.error.code).toBe("validation_error");
    });
  });

  it("generated openapi.json is valid JSON matching openApiDocument", () => {
    const rawFile = fs.readFileSync("openapi.json", "utf-8");
    const parsed = JSON.parse(rawFile);
    expect(parsed.openapi).toBe("3.1.0");
    expect(parsed.paths["/policies/evaluate"]).toBeDefined();
  });
});
