import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(currentDir, "..", "fixtures");

async function loadJsonFixture(filename) {
  const path = join(fixturesDir, filename);
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

test("success fixture follows the email-template-library contract", async () => {
  const fixture = await loadJsonFixture("success.json");

  assert.ok(fixture.templates, "fixture must include templates array");
  assert.ok(Array.isArray(fixture.templates), "templates must be an array");
  assert.ok(fixture.request, "fixture must include request object");
  assert.ok(fixture.expected, "fixture must include expected result");

  assert.equal(fixture.request.tool, "email-template-library");
  assert.equal(fixture.request.version, 1);
  assert.ok(["list", "get", "render"].includes(fixture.request.operation));

  for (const template of fixture.templates) {
    assert.ok(template.id, "template needs an id");
    assert.equal(typeof template.name, "string", "template name must be a string");
    assert.ok(
      template.categoryId === null || typeof template.categoryId === "string",
      "categoryId must be string or null",
    );
    assert.equal(typeof template.subject, "string", "subject must be a string");
    assert.equal(typeof template.body, "string", "body must be a string");
    assert.ok(Array.isArray(template.variables), "variables must be an array");

    for (const variable of template.variables) {
      assert.ok(variable.key, "variable must have a key");
      assert.ok(variable.label, "variable must have a label");
      assert.equal(typeof variable.key, "string", "variable key must be string");
      assert.equal(typeof variable.label, "string", "variable label must be string");
    }
  }
});

test("failure-template-not-found fixture includes proper error structure", async () => {
  const fixture = await loadJsonFixture("failure-template-not-found.json");

  assert.ok(fixture.request, "fixture must include request");
  assert.ok(fixture.expectedError, "fixture must include expectedError");

  assert.equal(fixture.request.tool, "email-template-library");
  assert.equal(fixture.request.version, 1);

  assert.equal(fixture.expectedError.code, "TEMPLATE_NOT_FOUND");
  assert.equal(typeof fixture.expectedError.message, "string");
  assert.ok(fixture.expectedError.message.length > 0, "message must not be empty");
  assert.ok(fixture.expectedError.details?.templateId, "details must include templateId");
});

test("failure-missing-variables fixture includes proper error structure", async () => {
  const fixture = await loadJsonFixture("failure-missing-variables.json");

  assert.ok(fixture.request, "fixture must include request");
  assert.ok(fixture.expectedError, "fixture must include expectedError");

  assert.equal(fixture.request.tool, "email-template-library");
  assert.equal(fixture.request.version, 1);
  assert.equal(fixture.request.operation, "render");

  assert.equal(fixture.expectedError.code, "MISSING_VARIABLES");
  assert.equal(typeof fixture.expectedError.message, "string");
  assert.ok(fixture.expectedError.message.length > 0, "message must not be empty");
  assert.ok(
    Array.isArray(fixture.expectedError.details?.missingVariables),
    "details must include missingVariables array",
  );
  assert.ok(
    fixture.expectedError.details.missingVariables.length > 0,
    "missingVariables must not be empty",
  );
});

test("template IDs are unique across fixtures", async () => {
  const success = await loadJsonFixture("success.json");

  const ids = success.templates.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "template IDs must be unique");
});

test("variable keys follow identifier pattern", async () => {
  const success = await loadJsonFixture("success.json");
  const keyPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

  for (const template of success.templates) {
    for (const variable of template.variables) {
      assert.ok(
        keyPattern.test(variable.key),
        `variable key "${variable.key}" must be a valid identifier`,
      );
    }
  }
});

test("template variables are unique within each template", async () => {
  const success = await loadJsonFixture("success.json");

  for (const template of success.templates) {
    const keys = template.variables.map((v) => v.key);
    assert.equal(
      new Set(keys).size,
      keys.length,
      `template ${template.id} must have unique variable keys`,
    );
  }
});
