import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const toolRoot = join(__dirname, "..");
const docsDir = join(toolRoot, "docs");
const fixturePath = join(toolRoot, "fixtures", "architecture-module-map.json");

const architecturePlan = readFileSync(join(docsDir, "ARCHITECTURE_PLAN.md"), "utf8");
const dataBoundaries = readFileSync(join(docsDir, "DATA_BOUNDARIES.md"), "utf8");
const moduleMap = JSON.parse(readFileSync(fixturePath, "utf8"));

describe("architecture plan", () => {
  it("documents the folder-local boundary and forbidden app areas", () => {
    assert.match(architecturePlan, /tools\/v1\/team\/email-ownership-tracker\//);

    for (const forbidden of [
      "app shell",
      "routing",
      "inbox architecture",
      "wallet core",
      "Stellar core",
      "database schema",
      "shared design system",
    ]) {
      assert.ok(
        architecturePlan.includes(forbidden),
        `expected architecture plan to mention ${forbidden}`,
      );
    }
  });

  it("defines the required internal modules for future contributors", () => {
    for (const moduleName of [
      "Public API",
      "Types",
      "Services",
      "Guards",
      "Hooks",
      "Components",
      "Fixtures",
      "Tests",
      "Docs",
    ]) {
      assert.ok(architecturePlan.includes(moduleName), `missing ${moduleName} module`);
    }
  });

  it("contains contributor rules for allowed and forbidden changes", () => {
    assert.match(architecturePlan, /Future contributors may:/);
    assert.match(architecturePlan, /Future contributors may not:/);
    assert.match(architecturePlan, /No app integration code is added/);
  });
});

describe("data boundaries", () => {
  it("documents owned data without claiming product-owned systems", () => {
    for (const owned of [
      "ownership event snapshots",
      "current-owner summaries",
      "attachment metadata",
      "deterministic fixtures",
    ]) {
      assert.ok(dataBoundaries.includes(owned), `missing owned data: ${owned}`);
    }

    for (const notOwned of ["mailbox records", "wallet accounts", "database rows"]) {
      assert.ok(dataBoundaries.includes(notOwned), `missing non-owned data: ${notOwned}`);
    }
  });

  it("requires future adapters to document product data ownership", () => {
    assert.match(dataBoundaries, /Future Adapter Handoff/);
    assert.match(dataBoundaries, /identify the source mailbox event and its owner/);
    assert.match(dataBoundaries, /keep writes behind a separately reviewed ownership-write issue/);
  });
});

describe("module map fixture", () => {
  it("is scoped to the issue folder", () => {
    assert.equal(moduleMap.tool, "Email Ownership Tracker");
    assert.equal(moduleMap.root, "tools/v1/team/email-ownership-tracker/");
    assert.equal(moduleMap.releaseTier, "V1");
    assert.equal(moduleMap.audience, "team");
  });

  it("covers every required folder-local architecture layer", () => {
    const moduleNames = new Set(moduleMap.modules.map((module) => module.name));

    for (const expected of [
      "public-api",
      "types",
      "services",
      "guards",
      "hooks",
      "components",
      "fixtures",
      "tests",
      "docs",
    ]) {
      assert.ok(moduleNames.has(expected), `missing module map entry: ${expected}`);
    }
  });

  it("marks each module with owner, responsibility, and import constraints", () => {
    for (const module of moduleMap.modules) {
      assert.equal(typeof module.name, "string");
      assert.equal(typeof module.path, "string");
      assert.equal(typeof module.owner, "string");
      assert.equal(typeof module.responsibility, "string");
      assert.ok(Array.isArray(module.allowedImports));
      assert.ok(Array.isArray(module.forbiddenImports));
      assert.ok(module.path.length > 0);
      assert.ok(module.owner.length > 0);
      assert.ok(module.responsibility.length > 0);
    }
  });

  it("keeps sensitive app areas in the forbidden change list", () => {
    for (const area of [
      "src/",
      "routing",
      "inbox architecture",
      "wallet core",
      "Stellar core",
      "database schema",
      "shared design system",
    ]) {
      assert.ok(moduleMap.forbiddenChangeAreas.includes(area), `missing forbidden area: ${area}`);
    }
  });
});
