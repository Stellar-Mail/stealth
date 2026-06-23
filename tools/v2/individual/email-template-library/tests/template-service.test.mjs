import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  createTemplateService,
  extractTemplateVariables,
  normalizeTemplate,
  validateTemplate,
} from "../index.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "templates.json");

async function loadFixtures() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("extractTemplateVariables returns unique declared placeholders", () => {
  const variables = extractTemplateVariables("Hi {{firstName}}", "{{ firstName }} from {{companyName}}");
  assert.deepEqual(variables, ["firstName", "companyName"]);
});

test("validateTemplate reports malformed template payloads", () => {
  const errors = validateTemplate({
    id: "",
    name: "",
    categoryId: 123,
    subject: 1,
    body: null,
    variables: [{ key: "bad key", label: "Bad" }],
  });

  assert.deepEqual(errors, [
    "id is required",
    "name is required",
    "categoryId must be a string or null",
    "subject must be a string",
    "body must be a string",
    "variables must have valid keys",
  ]);
});

test("normalizeTemplate adds missing placeholder declarations", () => {
  const result = normalizeTemplate({
    id: "tpl-auto",
    name: "Auto declarations",
    categoryId: null,
    subject: "Hello {{firstName}}",
    body: "Ticket {{ticketId}} is ready.",
    variables: [{ key: "firstName", label: "First name" }],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.variables.map((variable) => variable.key), ["firstName", "ticketId"]);
});

test("createTemplateService lists cloned templates and categories", async () => {
  const { templates, categories } = await loadFixtures();
  const service = createTemplateService({ initialTemplates: templates, categories });

  const listed = service.listTemplates();
  listed[0].name = "mutated outside";

  assert.equal(service.listTemplates().length, 3);
  assert.equal(service.listTemplates()[0].name, "Password reset follow-up");
  assert.equal(service.listCategories().length, 3);
});

test("getTemplate returns null for unknown ids", async () => {
  const { templates } = await loadFixtures();
  const service = createTemplateService({ initialTemplates: templates });

  assert.equal(service.getTemplate("missing"), null);
});

test("saveTemplate creates and updates templates immutably", async () => {
  const { templates } = await loadFixtures();
  const service = createTemplateService({ initialTemplates: templates });

  const createResult = service.saveTemplate({
    id: "tpl-new",
    name: "New template",
    categoryId: "support",
    subject: "Hello {{firstName}}",
    body: "Thanks, {{firstName}}.",
    variables: [{ key: "firstName", label: "First name" }],
  });

  assert.equal(createResult.ok, true);
  assert.equal(service.listTemplates().length, 4);

  const updateResult = service.saveTemplate({
    ...createResult.template,
    name: "Updated template",
  });

  assert.equal(updateResult.ok, true);
  assert.equal(service.getTemplate("tpl-new").name, "Updated template");
  assert.equal(service.listTemplates().length, 4);
});

test("saveTemplate rejects invalid templates without mutating the store", async () => {
  const { templates } = await loadFixtures();
  const service = createTemplateService({ initialTemplates: templates });
  const result = service.saveTemplate({ id: "", name: "", subject: "", body: "", variables: [] });

  assert.equal(result.ok, false);
  assert.equal(service.listTemplates().length, 3);
});

test("deleteTemplate removes existing templates and reports missing ids", async () => {
  const { templates } = await loadFixtures();
  const service = createTemplateService({ initialTemplates: templates });

  assert.deepEqual(service.deleteTemplate("tpl-follow-up"), { ok: true, deleted: true });
  assert.equal(service.getTemplate("tpl-follow-up"), null);
  assert.deepEqual(service.deleteTemplate("tpl-follow-up"), { ok: false, deleted: false });
});

test("searchTemplates filters by text and category", async () => {
  const { templates } = await loadFixtures();
  const service = createTemplateService({ initialTemplates: templates });

  assert.equal(service.searchTemplates("demo").length, 1);
  assert.equal(service.searchTemplates("", { categoryId: "support" }).length, 1);
  assert.equal(service.searchTemplates("follow", { categoryId: "sales" }).length, 0);
});

test("renderTemplate substitutes provided values and reports missing variables", async () => {
  const { templates } = await loadFixtures();
  const service = createTemplateService({ initialTemplates: templates });
  const result = service.renderTemplate("tpl-sales-demo", {
    firstName: "Ari",
    companyName: "Example Co",
    timeOptionOne: "Tuesday 10:00",
  });

  assert.equal(result.ok, true);
  assert.equal(result.subject, "Demo times for Example Co");
  assert.match(result.body, /Tuesday 10:00/);
  assert.deepEqual(result.missingVariables, ["timeOptionTwo"]);
});

test("renderTemplate returns an error result for unknown ids", async () => {
  const { templates } = await loadFixtures();
  const service = createTemplateService({ initialTemplates: templates });
  const result = service.renderTemplate("missing", {});

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ["template missing not found"]);
});
