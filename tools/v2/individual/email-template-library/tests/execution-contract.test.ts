import assert from "node:assert/strict";
import test from "node:test";

import { createEmailTemplateLibraryService, executeEmailTemplateLibrary } from "../index.ts";
import type { EmailTemplate, EmailTemplateLibraryRequest } from "../types/index.ts";

const TOOL = "email-template-library";
const VERSION = 1;

function catalog(): EmailTemplate[] {
  return [
    {
      id: "template-follow-up",
      name: "Friendly follow-up",
      categoryId: "follow-up",
      subject: "Following up, {{firstName}}",
      body: "Hello {{firstName}},\n\nAbout {{topic}}.",
      variables: [
        { key: "firstName", label: "First name" },
        { key: "topic", label: "Topic" },
      ],
    },
    {
      id: "template-welcome",
      name: "Welcome note",
      categoryId: "onboarding",
      subject: "Welcome aboard",
      body: "We are glad you are here.",
      variables: [],
    },
  ];
}

function run(request: unknown, templates: readonly EmailTemplate[] = catalog()) {
  return executeEmailTemplateLibrary(request as EmailTemplateLibraryRequest, templates);
}

test("list returns every template by default", () => {
  const res = run({ tool: TOOL, version: VERSION, operation: "list" });
  assert.equal(res.status, "ok");
  if (res.status === "ok" && res.result.operation === "list") {
    assert.equal(res.result.templates.length, 2);
  }
});

test("list filters by categoryId", () => {
  const res = run({ tool: TOOL, version: VERSION, operation: "list", categoryId: "onboarding" });
  assert.equal(res.status, "ok");
  if (res.status === "ok" && res.result.operation === "list") {
    assert.equal(res.result.templates.length, 1);
    assert.equal(res.result.templates[0].id, "template-welcome");
  }
});

test("list with an unknown categoryId returns no templates", () => {
  const res = run({ tool: TOOL, version: VERSION, operation: "list", categoryId: "missing" });
  assert.equal(res.status, "ok");
  if (res.status === "ok" && res.result.operation === "list") {
    assert.equal(res.result.templates.length, 0);
  }
});

test("get returns a single template by id", () => {
  const res = run({
    tool: TOOL,
    version: VERSION,
    operation: "get",
    templateId: "template-welcome",
  });
  assert.equal(res.status, "ok");
  if (res.status === "ok" && res.result.operation === "get") {
    assert.equal(res.result.template.name, "Welcome note");
  }
});

test("render substitutes declared variables", () => {
  const res = run({
    tool: TOOL,
    version: VERSION,
    operation: "render",
    templateId: "template-follow-up",
    values: { firstName: "Sam", topic: "the launch" },
  });
  assert.equal(res.status, "ok");
  if (res.status === "ok" && res.result.operation === "render") {
    assert.equal(res.result.subject, "Following up, Sam");
    assert.equal(res.result.body, "Hello Sam,\n\nAbout the launch.");
  }
});

test("render leaves unknown placeholders untouched", () => {
  const templates: EmailTemplate[] = [
    {
      id: "template-raw",
      name: "Raw",
      categoryId: null,
      subject: "Hi {{firstName}}",
      body: "Ref {{unknownKey}} stays.",
      variables: [{ key: "firstName", label: "First name" }],
    },
  ];
  const res = run(
    {
      tool: TOOL,
      version: VERSION,
      operation: "render",
      templateId: "template-raw",
      values: { firstName: "Sam" },
    },
    templates,
  );
  assert.equal(res.status, "ok");
  if (res.status === "ok" && res.result.operation === "render") {
    assert.equal(res.result.body, "Ref {{unknownKey}} stays.");
  }
});

test("rejects an unsupported version", () => {
  const res = run({ tool: TOOL, version: 2, operation: "list" });
  assert.equal(res.status, "error");
  if (res.status === "error") {
    assert.equal(res.error.code, "UNSUPPORTED_VERSION");
  }
});

test("rejects a foreign tool envelope", () => {
  const res = run({ tool: "other-tool", version: VERSION, operation: "list" });
  assert.equal(res.status, "error");
  if (res.status === "error") {
    assert.equal(res.error.code, "INVALID_REQUEST");
  }
});

test("rejects an unknown operation", () => {
  const res = run({ tool: TOOL, version: VERSION, operation: "purge" });
  assert.equal(res.status, "error");
  if (res.status === "error") {
    assert.equal(res.error.code, "INVALID_REQUEST");
  }
});

test("rejects render values that are not strings", () => {
  const res = run({
    tool: TOOL,
    version: VERSION,
    operation: "render",
    templateId: "template-follow-up",
    values: { firstName: 42 },
  });
  assert.equal(res.status, "error");
  if (res.status === "error") {
    assert.equal(res.error.code, "INVALID_REQUEST");
  }
});

test("reports an unknown template id", () => {
  const res = run({ tool: TOOL, version: VERSION, operation: "get", templateId: "nope" });
  assert.equal(res.status, "error");
  if (res.status === "error") {
    assert.equal(res.error.code, "TEMPLATE_NOT_FOUND");
    assert.equal(res.error.details?.templateId, "nope");
  }
});

test("reports missing render variables", () => {
  const res = run({
    tool: TOOL,
    version: VERSION,
    operation: "render",
    templateId: "template-follow-up",
    values: { firstName: "Sam" },
  });
  assert.equal(res.status, "error");
  if (res.status === "error") {
    assert.equal(res.error.code, "MISSING_VARIABLES");
    assert.deepEqual(res.error.details?.missingVariables, ["topic"]);
  }
});

test("rejects a catalog that contains an invalid template", () => {
  const badCatalog: EmailTemplate[] = [
    { id: "", name: "", categoryId: null, subject: "s", body: "b", variables: [] },
  ];
  const res = run({ tool: TOOL, version: VERSION, operation: "list" }, badCatalog);
  assert.equal(res.status, "error");
  if (res.status === "error") {
    assert.equal(res.error.code, "INVALID_TEMPLATE");
  }
});

test("createEmailTemplateLibraryService executes against a snapshot", () => {
  const service = createEmailTemplateLibraryService(catalog());
  const res = service.execute({
    tool: TOOL,
    version: VERSION,
    operation: "get",
    templateId: "template-follow-up",
  });
  assert.equal(res.status, "ok");
  if (res.status === "ok" && res.result.operation === "get") {
    assert.equal(res.result.template.id, "template-follow-up");
  }
});

test("createEmailTemplateLibraryService throws on an invalid catalog", () => {
  const badCatalog: EmailTemplate[] = [
    { id: "", name: "x", categoryId: null, subject: "s", body: "b", variables: [] },
  ];
  assert.throws(() => createEmailTemplateLibraryService(badCatalog));
});

test("createEmailTemplateLibraryService isolates its source snapshot", () => {
  const source = catalog();
  const service = createEmailTemplateLibraryService(source);
  source[0].name = "mutated after construction";
  const res = service.execute({
    tool: TOOL,
    version: VERSION,
    operation: "get",
    templateId: "template-follow-up",
  });
  assert.equal(res.status, "ok");
  if (res.status === "ok" && res.result.operation === "get") {
    assert.equal(res.result.template.name, "Friendly follow-up");
  }
});

test("render escapes HTML characters in substituted variables", () => {
  const res = run({
    tool: TOOL,
    version: VERSION,
    operation: "render",
    templateId: "template-follow-up",
    values: { firstName: "<script>alert(1)</script>", topic: "a & b \"c\" 'd'" },
  });
  assert.equal(res.status, "ok");
  if (res.status === "ok" && res.result.operation === "render") {
    assert.equal(res.result.subject, "Following up, &lt;script&gt;alert(1)&lt;/script&gt;");
    assert.equal(
      res.result.body,
      "Hello &lt;script&gt;alert(1)&lt;/script&gt;,\n\nAbout a &amp; b &quot;c&quot; &#039;d&#039;.",
    );
  }
});

test("rejects render values that exceed the maximum length", () => {
  const longValue = "A".repeat(10 * 1024 + 1); // 1 byte over 10 KB
  const res = run({
    tool: TOOL,
    version: VERSION,
    operation: "render",
    templateId: "template-follow-up",
    values: { firstName: "Sam", topic: longValue },
  });
  assert.equal(res.status, "error");
  if (res.status === "error") {
    assert.equal(res.error.code, "VARIABLE_TOO_LARGE");
    assert.deepEqual(res.error.details?.fields, ["topic"]);
  }
});

test("rejects a catalog containing a template body that is too large", () => {
  const badCatalog: EmailTemplate[] = [
    {
      id: "big",
      name: "Big",
      categoryId: null,
      subject: "s",
      body: "A".repeat(100 * 1024 + 1),
      variables: [],
    },
  ];
  const res = run({ tool: TOOL, version: VERSION, operation: "list" }, badCatalog);
  assert.equal(res.status, "error");
  if (res.status === "error") {
    assert.equal(res.error.code, "INVALID_TEMPLATE");
  }
});
