import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  EmailTemplateLibraryError,
  createEmptyState,
  createErrorState,
  createLoadingState,
  createTemplateListState,
  createTemplateService,
  extractTemplateVariables,
  renderTemplateContent,
  scoreTemplate,
  validateTemplate,
  validateTemplateVariable,
} from "../index.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dir, "..", "fixtures", "template-core-fixtures.json");

async function loadFixtures() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

test("fixture metadata describes synthetic folder-local data", async () => {
  const fixture = await loadFixtures();

  assert.equal(fixture.metadata.tool, "email-template-library");
  assert.equal(fixture.metadata.scope, "folder-local");
  assert.ok(fixture.metadata.dataPolicy.some((entry) => entry.includes("Synthetic")));
});

test("extractTemplateVariables returns unique sorted placeholder keys", () => {
  assert.deepEqual(
    extractTemplateVariables("Hello {{ firstName }}", "Topic {{topic}} {{firstName}}"),
    ["firstName", "topic"],
  );
});

test("validateTemplateVariable accepts valid variable definitions", () => {
  assert.deepEqual(validateTemplateVariable({ key: "firstName", label: "First name" }), {
    key: "firstName",
    label: "First name",
  });
});

test("validateTemplate rejects undeclared placeholders", async () => {
  const { templates } = await loadFixtures();

  assert.throws(
    () =>
      validateTemplate({
        ...templates[0],
        body: "Hello {{missingKey}}",
      }),
    EmailTemplateLibraryError,
  );
});

test("renderTemplateContent substitutes values and reports missing variables", async () => {
  const { templates } = await loadFixtures();
  const result = renderTemplateContent(templates[0], { firstName: "Ada" });

  assert.equal(result.subject, "Following up on");
  assert.equal(result.body.includes("Hi Ada"), true);
  assert.deepEqual(result.missingVariables, ["topic"]);
});

test("scoreTemplate ranks matching templates above unrelated templates", async () => {
  const { templates, categories } = await loadFixtures();
  const categoryLookup = new Map(categories.map((category) => [category.id, category.name]));

  const billingScore = scoreTemplate(templates[1], "invoice receipt billing", categoryLookup);
  const supportScore = scoreTemplate(templates[2], "invoice receipt billing", categoryLookup);

  assert.ok(billingScore > supportScore);
});

test("createTemplateListState returns success for matching search", async () => {
  const { templates, categories } = await loadFixtures();
  const state = createTemplateListState({ query: "invoice receipt" }, templates, categories);

  assert.equal(state.status, "success");
  assert.equal(state.templates[0].id, "tmpl-invoice-copy");
});

test("createTemplateListState returns empty for unmatched search", async () => {
  const { templates, categories } = await loadFixtures();
  const state = createTemplateListState({ query: "banana telescope" }, templates, categories);

  assert.equal(state.status, "empty");
  assert.deepEqual(state.templates, []);
});

test("fixture search cases return expected first result", async () => {
  const { templates, categories, searchCases } = await loadFixtures();

  for (const searchCase of searchCases) {
    const state = createTemplateListState(searchCase.input, templates, categories);
    const firstId = state.templates[0]?.id ?? null;
    assert.equal(firstId, searchCase.expectedFirstId, searchCase.id);
  }
});

test("service exposes CRUD and returns cloned templates", async () => {
  const { templates, categories } = await loadFixtures();
  const service = createTemplateService({ templates, categories });

  const original = service.getTemplate("tmpl-follow-up");
  original.name = "mutated";

  assert.notEqual(service.getTemplate("tmpl-follow-up").name, "mutated");

  service.saveTemplate({
    id: "tmpl-new",
    name: "New template",
    categoryId: "cat-support",
    subject: "Case {{caseId}} update",
    body: "Case {{caseId}} is still under review.",
    variables: [{ key: "caseId", label: "Case ID" }],
    tags: ["support"],
  });

  assert.equal(service.getTemplate("tmpl-new").name, "New template");
  assert.equal(service.deleteTemplate("tmpl-new"), true);
  assert.equal(service.getTemplate("tmpl-new"), null);
});

test("service rejects unknown category ids on save", async () => {
  const { templates, categories } = await loadFixtures();
  const service = createTemplateService({ templates, categories });

  assert.throws(
    () =>
      service.saveTemplate({
        id: "tmpl-bad",
        name: "Bad category",
        categoryId: "cat-missing",
        subject: "Hello",
        body: "Body",
        variables: [],
      }),
    EmailTemplateLibraryError,
  );
});

test("service renders a template by id", async () => {
  const { templates, categories } = await loadFixtures();
  const service = createTemplateService({ templates, categories });
  const result = service.renderTemplate("tmpl-invoice-copy", {
    firstName: "Riley",
    invoiceMonth: "June",
  });

  assert.equal(result.subject, "Invoice copy for June");
  assert.equal(result.body.includes("Hi Riley"), true);
  assert.deepEqual(result.missingVariables, []);
});

test("state helpers expose loading, empty, and error contracts", () => {
  assert.equal(createLoadingState("invoice").status, "loading");
  assert.equal(createLoadingState("invoice").isLoading, true);
  assert.equal(createEmptyState("invoice").status, "empty");

  const errorState = createErrorState(new EmailTemplateLibraryError("bad", "template.id"), "x");
  assert.equal(errorState.status, "error");
  assert.equal(errorState.error.field, "template.id");
});
