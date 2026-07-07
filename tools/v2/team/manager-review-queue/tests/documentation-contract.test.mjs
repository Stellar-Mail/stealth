import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readToolFile(relativePath) {
  return readFile(join(toolRoot, relativePath), "utf8");
}

function assertIncludesAll(content, values, label) {
  for (const value of values) {
    assert.ok(content.includes(value), `${label} should include "${value}"`);
  }
}

test("README documents isolated setup, tests, fixtures, and limitations", async () => {
  const readme = await readToolFile("README.md");

  assertIncludesAll(
    readme,
    [
      "tools/v2/team/manager-review-queue/",
      "node --test tools/v2/team/manager-review-queue/tests/review-guards.test.mjs",
      "node --test tools/v2/team/manager-review-queue/tests/documentation-contract.test.mjs",
      "fixtures/sample-review-requests.json",
      "Known Limitations",
      "No files outside `tools/v2/team/manager-review-queue/` are needed.",
    ],
    "README",
  );

  assert.match(readme, /Do not wire this tool into the main app/);
  assert.match(readme, /All fixture data is local and synthetic/);
});

test("specs define the V2 team scope without template remnants", async () => {
  const specs = await readToolFile("specs.md");

  assertIncludesAll(
    specs,
    [
      "Release tier: V2",
      "Audience: team",
      "Folder ownership: `tools/v2/team/manager-review-queue/`",
      "Testing and documentation",
      "Review Contract",
      "Out of Scope",
    ],
    "specs.md",
  );

  assert.doesNotMatch(specs, /System\.Collections|Set-Content|\$dir|@"/);
});

test("test plan covers automated and manual review paths", async () => {
  const plan = await readToolFile("docs/test-plan.md");

  assertIncludesAll(
    plan,
    [
      "node --test tools/v2/team/manager-review-queue/tests/review-guards.test.mjs",
      "node --test tools/v2/team/manager-review-queue/tests/documentation-contract.test.mjs",
      "Guard Test Coverage",
      "Documentation Contract Coverage",
      "Manual Functional Review",
      "Manual Accessibility Review",
      "Manual Security and Performance Review",
      "Known Limitations",
    ],
    "docs/test-plan.md",
  );
});

test("review notes explain scope, validation commands, and exclusions", async () => {
  const notes = await readToolFile("docs/review-notes.md");

  assertIncludesAll(
    notes,
    [
      "Every changed file should live under `tools/v2/team/manager-review-queue/`.",
      "tests/review-guards.test.mjs",
      "tests/documentation-contract.test.mjs",
      "git diff --check",
      "What Is Intentionally Not Included",
      "No app route, navigation link, dashboard integration, or inbox data connection.",
    ],
    "docs/review-notes.md",
  );
});

test("README links existing implementation docs for independent review", async () => {
  const readme = await readToolFile("README.md");

  assertIncludesAll(
    readme,
    [
      "docs/api.md",
      "docs/security-and-performance.md",
      "docs/ACCESSIBILITY.md",
      "docs/VISUAL_STYLE.md",
    ],
    "README implementation doc links",
  );
});
