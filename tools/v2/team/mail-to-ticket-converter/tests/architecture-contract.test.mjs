import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const toolDir = join(currentDir, "..");

const docs = {
  readme: join(toolDir, "README.md"),
  specs: join(toolDir, "specs.md"),
  architecture: join(toolDir, "docs", "ARCHITECTURE.md"),
  dataOwnership: join(toolDir, "docs", "DATA_OWNERSHIP.md"),
};

async function readDoc(path) {
  return readFile(path, "utf8");
}

test("architecture docs define folder-local module boundaries", async () => {
  const [readme, specs, architecture] = await Promise.all([
    readDoc(docs.readme),
    readDoc(docs.specs),
    readDoc(docs.architecture),
  ]);

  const combined = `${readme}\n${specs}\n${architecture}`;

  assert.ok(combined.includes("tools/v2/team/mail-to-ticket-converter/"));
  assert.ok(readme.includes("docs/ARCHITECTURE.md"));
  assert.ok(readme.includes("docs/DATA_OWNERSHIP.md"));

  for (const boundary of ["components/", "services/", "hooks/", "tests/", "docs/"]) {
    assert.ok(combined.includes(boundary), `${boundary} boundary must be documented`);
  }

  assert.ok(architecture.includes("components/ -> hooks/ -> services/"));
  assert.ok(specs.includes("Components should not call services directly"));
});

test("data ownership and integration constraints are explicit", async () => {
  const [specs, architecture, dataOwnership] = await Promise.all([
    readDoc(docs.specs),
    readDoc(docs.architecture),
    readDoc(docs.dataOwnership),
  ]);

  assert.ok(specs.includes("Release tier: V2"));
  assert.ok(specs.includes("Audience: team"));
  assert.ok(dataOwnership.includes("Fixtures must be synthetic"));
  assert.ok(dataOwnership.includes("must not own or mutate"));
  assert.ok(dataOwnership.includes("ticketing provider records"));

  for (const forbidden of [
    "main app shell",
    "routing",
    "inbox architecture",
    "wallet",
    "Stellar",
    "database",
    "ticketing provider",
    "design system",
  ]) {
    assert.ok(
      architecture.toLowerCase().includes(forbidden.toLowerCase()),
      `${forbidden} constraint must be documented`,
    );
  }
});

test("template placeholders are removed from contributor-facing docs", async () => {
  const [readme, specs] = await Promise.all([readDoc(docs.readme), readDoc(docs.specs)]);
  const combined = `${readme}\n${specs}`;

  for (const residue of ["$dir", "Set-Content", "System.Collections", '@"']) {
    assert.equal(combined.includes(residue), false, `${residue} template residue remains`);
  }
});
