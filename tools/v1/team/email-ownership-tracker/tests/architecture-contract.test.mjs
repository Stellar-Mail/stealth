import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = path.resolve(__dirname, "..");

async function listFiles(dir = toolRoot) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const absolute = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(absolute) : absolute;
    }),
  );

  return files.flat();
}

async function readToolFile(relativePath) {
  return readFile(path.join(toolRoot, relativePath), "utf8");
}

test("architecture docs define folder-local module boundaries", async () => {
  const readme = await readToolFile("README.md");
  const architecture = await readToolFile("docs/ARCHITECTURE.md");

  for (const folder of ["components/", "services/", "hooks/", "fixtures/", "tests/", "docs/"]) {
    assert.match(readme, new RegExp(folder.replace("/", "\\/")));
    assert.match(architecture, new RegExp(folder.replace("/", "\\/")));
  }

  assert.match(readme, /tools\/v1\/team\/email-ownership-tracker\//);
  assert.match(architecture, /No module in this tool may import from `src\/`/);
});

test("specs describe scope, data ownership, and contributor limits", async () => {
  const specs = await readToolFile("specs.md");
  const boundary = await readToolFile("docs/CONTRIBUTOR_BOUNDARY.md");

  for (const term of [
    "Release tier: V1",
    "Audience: team",
    "Data Ownership",
    "ownership action",
    "Out of Scope",
  ]) {
    assert.match(specs, new RegExp(term));
  }

  for (const term of [
    "Contributors May Change",
    "Contributors Must Not Change",
    "Dependency Rules",
    "Integration Constraints",
  ]) {
    assert.match(boundary, new RegExp(term));
  }
});

test("architecture contract rejects generated template residue", async () => {
  const files = await listFiles();
  const textFiles = files.filter((file) => /\.(md|json)$/.test(file));
  const combined = (
    await Promise.all(textFiles.map((file) => readFile(file, "utf8")))
  ).join("\n");

  assert.doesNotMatch(combined, /System\.Collections|Set-Content|@\s*\||\$dir|\$\(.*\)/);
  assert.doesNotMatch(combined, /components\/\n- services\/\n- hooks\/\n-\s+ests\//);
});

test("integration and dependency boundaries remain explicit", async () => {
  const architecture = await readToolFile("docs/ARCHITECTURE.md");
  const boundary = await readToolFile("docs/CONTRIBUTOR_BOUNDARY.md");
  const combined = `${architecture}\n${boundary}`;

  for (const forbiddenArea of [
    "routing",
    "wallet core",
    "Stellar core",
    "database schema",
    "shared design system",
    "production data",
    "secrets",
  ]) {
    assert.match(combined, new RegExp(forbiddenArea, "i"));
  }

  assert.match(combined, /no live network calls/i);
  assert.match(combined, /\.test` domains/);
});

test("all current files stay under the Email Ownership Tracker root", async () => {
  const files = await listFiles();

  assert.ok(files.length >= 5, "expected README, specs, docs, and tests");

  for (const file of files) {
    assert.ok(file.startsWith(toolRoot), `file escaped the tool root: ${file}`);
  }
});
