import assert from "node:assert/strict";
import test from "node:test";

import { analyzeTemplate, extractPlaceholders } from "../services/templateAnalysis.ts";
import type { EmailTemplate } from "../types/index.ts";

function template(overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    id: "t1",
    name: "Test",
    categoryId: null,
    subject: "Hello {{ name }}",
    body: "Hi {{ name }}, your order {{ orderId }} shipped.",
    variables: [
      { key: "name", label: "Name" },
      { key: "orderId", label: "Order ID" },
    ],
    ...overrides,
  };
}

test("extractPlaceholders returns unique keys in first-seen order", () => {
  assert.deepEqual(extractPlaceholders("{{ a }} {{b}} then {{ a }} and {{c}}"), ["a", "b", "c"]);
});

test("extractPlaceholders tolerates empty/non-string input", () => {
  assert.deepEqual(extractPlaceholders(""), []);
  assert.deepEqual(extractPlaceholders(undefined as unknown as string), []);
});

test("a fully-declared template is consistent with no warnings", () => {
  const analysis = analyzeTemplate(template());
  assert.deepEqual(analysis.referencedKeys, ["name", "orderId"]);
  assert.deepEqual(analysis.declaredKeys, ["name", "orderId"]);
  assert.deepEqual(analysis.undeclaredPlaceholders, []);
  assert.deepEqual(analysis.unusedVariables, []);
  assert.equal(analysis.isConsistent, true);
});

test("undeclared placeholders make a template inconsistent", () => {
  const analysis = analyzeTemplate(
    template({
      body: "Hi {{ name }}, ref {{ trackingCode }}",
      variables: [{ key: "name", label: "Name" }],
    }),
  );
  assert.deepEqual(analysis.undeclaredPlaceholders, ["trackingCode"]);
  assert.equal(analysis.isConsistent, false);
});

test("unused declared variables are a soft warning, still consistent", () => {
  const analysis = analyzeTemplate(
    template({
      subject: "Hello {{ name }}",
      body: "No other placeholders here.",
      variables: [
        { key: "name", label: "Name" },
        { key: "orderId", label: "Order ID" },
      ],
    }),
  );
  assert.deepEqual(analysis.unusedVariables, ["orderId"]);
  assert.deepEqual(analysis.undeclaredPlaceholders, []);
  assert.equal(analysis.isConsistent, true);
});

test("placeholders in subject are detected too", () => {
  const analysis = analyzeTemplate(
    template({
      subject: "Order {{ orderId }} for {{ name }}",
      body: "static body",
      variables: [
        { key: "name", label: "Name" },
        { key: "orderId", label: "Order ID" },
      ],
    }),
  );
  assert.deepEqual(analysis.referencedKeys, ["orderId", "name"]);
  assert.equal(analysis.isConsistent, true);
});

test("analysis is deterministic for identical input", () => {
  const a = analyzeTemplate(template());
  const b = analyzeTemplate(template());
  assert.deepEqual(a, b);
});
