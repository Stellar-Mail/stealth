import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-drafts.json");

const allowedCategories = new Set([
  "spelling",
  "grammar",
  "clarity",
  "tone",
  "length",
  "structure",
  "action-item",
  "missing-field",
  "sensitive-content",
]);

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample drafts fixture follows the local contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "draft-improver");
  assert.ok(Array.isArray(fixture.drafts), "drafts must be an array");
  assert.ok(fixture.drafts.length >= 4, "fixture must include at least 4 draft samples");

  for (const draft of fixture.drafts) {
    assert.ok(draft.id, "draft needs a stable id");
    assert.equal(typeof draft.subject, "string", `${draft.id} subject must be a string`);
    assert.equal(typeof draft.body, "string", `${draft.id} body must be a string`);
    assert.equal(draft.containsPersonalData, false, `${draft.id} must be synthetic`);
    assert.ok(
      allowedCategories.has("action-item"),
      "category set is valid for expectedIssues keys",
    );

    if (draft.expectedIssues) {
      for (const key of Object.keys(draft.expectedIssues)) {
        assert.ok(
          allowedCategories.has(key),
          `${draft.id} unexpected category "${key}" in expectedIssues`,
        );
        assert.ok(Array.isArray(draft.expectedIssues[key]), `${key} must be an array`);
      }
    }
  }

  const ids = fixture.drafts.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, "draft ids must be unique");

  const idPattern = /^draft-/;
  for (const id of ids) {
    assert.ok(idPattern.test(id), `${id} must start with "draft-"`);
  }
});

test("fixture covers diverse issue scenarios", async () => {
  const fixture = await loadFixture();

  const hasSpelling = fixture.drafts.some(
    (d) => d.expectedIssues?.spelling && d.expectedIssues.spelling.length > 0,
  );
  const hasMissingField = fixture.drafts.some(
    (d) => d.expectedIssues?.["missing-field"] && d.expectedIssues["missing-field"].length > 0,
  );
  const hasSensitiveContent = fixture.drafts.some(
    (d) =>
      d.expectedIssues?.["sensitive-content"] && d.expectedIssues["sensitive-content"].length > 0,
  );
  const hasClean = fixture.drafts.some(
    (d) => d.expectedIssues && Object.values(d.expectedIssues).every((arr) => arr.length === 0),
  );

  assert.ok(hasSpelling, "fixture must include a draft with spelling errors");
  assert.ok(hasMissingField, "fixture must include a draft with missing fields");
  assert.ok(hasSensitiveContent, "fixture must include a draft with sensitive content");
  assert.ok(hasClean, "fixture must include a draft with no expected issues");
});
