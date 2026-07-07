import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const docs = join(root, "docs");
const moduleMap = JSON.parse(
  readFileSync(join(root, "fixtures", "architecture-boundary-map.json"), "utf8"),
);
const moduleBoundaries = readFileSync(join(docs, "MODULE_BOUNDARIES.md"), "utf8");
const dataOwnership = readFileSync(join(docs, "DATA_OWNERSHIP_CONTRACT.md"), "utf8");

describe("module boundary documentation", () => {
  it("states the folder-local scope and forbidden integration areas", () => {
    assert.match(moduleBoundaries, /tools\/v1\/individual\/follow-up-reminder\//);

    for (const forbidden of [
      "app shell",
      "routes",
      "inbox internals",
      "wallet",
      "Stellar",
      "database",
      "notification",
      "calendar",
      "shared design-system",
    ]) {
      assert.ok(moduleBoundaries.includes(forbidden), `missing forbidden area: ${forbidden}`);
    }
  });

  it("documents required layers for the self-contained mini-product", () => {
    for (const layer of [
      "Public API",
      "Engine",
      "Guards",
      "Fixtures",
      "Components",
      "Tests",
      "Docs",
    ]) {
      assert.ok(moduleBoundaries.includes(layer), `missing layer: ${layer}`);
    }
  });

  it("keeps engine state advisory and read-only", () => {
    assert.match(moduleBoundaries, /draft/);
    assert.match(moduleBoundaries, /no_action/);
    assert.match(moduleBoundaries, /never schedules/);
    assert.match(moduleBoundaries, /read-only/);
  });
});

describe("data ownership contract", () => {
  it("defines owned local data and product data that remains out of scope", () => {
    for (const owned of [
      "normalized email snapshots",
      "reminder review models",
      "signals and warnings",
    ]) {
      assert.ok(dataOwnership.includes(owned), `missing owned data: ${owned}`);
    }

    for (const external of [
      "mailbox records",
      "calendar events",
      "notification jobs",
      "wallet accounts",
    ]) {
      assert.ok(dataOwnership.includes(external), `missing external data: ${external}`);
    }
  });

  it("requires future integration handoff before product side effects", () => {
    assert.match(dataOwnership, /Integration Handoff/);
    assert.match(dataOwnership, /explicit confirmation/);
    assert.match(dataOwnership, /no production side effects/);
  });
});

describe("architecture boundary map fixture", () => {
  it("is scoped to the Follow-up Reminder tool", () => {
    assert.equal(moduleMap.tool, "Follow-up Reminder");
    assert.equal(moduleMap.root, "tools/v1/individual/follow-up-reminder/");
    assert.equal(moduleMap.releaseTier, "V1");
    assert.equal(moduleMap.audience, "individual");
  });

  it("covers the expected module owners", () => {
    const moduleNames = new Set(moduleMap.modules.map((entry) => entry.name));
    for (const expected of [
      "public-api",
      "engine",
      "guards",
      "fixtures",
      "components",
      "tests",
      "docs",
    ]) {
      assert.ok(moduleNames.has(expected), `missing module: ${expected}`);
    }
  });

  it("gives every module import constraints", () => {
    for (const entry of moduleMap.modules) {
      assert.equal(typeof entry.path, "string");
      assert.equal(typeof entry.owns, "string");
      assert.ok(Array.isArray(entry.mayImport));
      assert.ok(Array.isArray(entry.mustNotImport));
      assert.ok(entry.mustNotImport.length > 0);
    }
  });

  it("keeps integration areas and state ownership explicit", () => {
    for (const area of [
      "routing",
      "inbox architecture",
      "wallet core",
      "database schema",
      "calendar writes",
    ]) {
      assert.ok(
        moduleMap.forbiddenIntegrationAreas.includes(area),
        `missing forbidden area: ${area}`,
      );
    }

    assert.deepEqual(moduleMap.allowedStates, ["draft", "no_action"]);
    assert.deepEqual(moduleMap.uiOwnedStates, ["loading", "empty", "error", "review"]);
  });
});
