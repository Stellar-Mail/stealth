import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { executeEmailTemplateLibrary } from "../index.ts";
import type { EmailTemplate, EmailTemplateLibraryRequest } from "../types/index.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const load = async <T>(name: string): Promise<T> =>
  JSON.parse(await readFile(join(fixtures, name), "utf8")) as T;

test("renders a template from the success fixture", async () => {
  const fixture = await load<{
    templates: EmailTemplate[];
    request: EmailTemplateLibraryRequest;
    expected: unknown;
  }>("success.json");
  const response = executeEmailTemplateLibrary(fixture.request, fixture.templates);
  assert.equal(response.status, "ok");
  if (response.status === "ok") assert.deepEqual(response.result, fixture.expected);
});

test("returns stable failure codes from failure fixtures", async () => {
  const success = await load<{ templates: EmailTemplate[] }>("success.json");
  for (const name of ["failure-missing-variables.json", "failure-template-not-found.json"]) {
    const fixture = await load<{
      request: EmailTemplateLibraryRequest;
      expectedError: { code: string; missingVariables?: string[]; templateId?: string };
    }>(name);
    const response = executeEmailTemplateLibrary(fixture.request, success.templates);
    assert.equal(response.status, "error");
    if (response.status === "error") {
      assert.equal(response.error.code, fixture.expectedError.code);
      if (fixture.expectedError.missingVariables)
        assert.deepEqual(
          response.error.details?.missingVariables,
          fixture.expectedError.missingVariables,
        );
      if (fixture.expectedError.templateId)
        assert.equal(response.error.details?.templateId, fixture.expectedError.templateId);
    }
  }
});

test("list results are cloned and cannot mutate service source data", async () => {
  const fixture = await load<{ templates: EmailTemplate[] }>("success.json");
  const request = { tool: "email-template-library", version: 1, operation: "list" } as const;
  const first = executeEmailTemplateLibrary(request, fixture.templates);
  assert.equal(first.status, "ok");
  if (first.status !== "ok" || first.result.operation !== "list") return;
  first.result.templates[0].name = "mutated";
  const second = executeEmailTemplateLibrary(request, fixture.templates);
  assert.equal(second.status, "ok");
  if (second.status === "ok" && second.result.operation === "list")
    assert.equal(second.result.templates[0].name, "Friendly follow-up");
});
