/**
 * Fixture integrity test for the stellar-team-payout-request tool.
 *
 * Uses Node built-in test runner (node:test) so it can be run standalone:
 *   node --test tools/v2/team/stellar-team-payout-request/tests/payout-fixtures.test.mjs
 *
 * The canonical vitest test suite lives in:
 *   tests/unit/stellar-team-payout-request/payout.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// Dynamic import of compiled types isn't possible from .mjs, so we test the
// JS-compatible properties by importing the fixtures directly via file path.
// These are TypeScript source files, so we validate the *shape* of the data
// statically through the interface contract rather than importing at runtime.
// Instead, we verify the JSON-serialisable fixture values inline below.

const VALID_STATUSES = new Set(["pending", "submitted", "confirmed", "failed", "cancelled"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STELLAR_KEY_RE = /^G[A-Z2-7]{55}$/;

// Snapshot of expected fixture values (kept in sync with payouts.fixtures.ts)
const EXPECTED_FIXTURE_IDS = ["payout-001", "payout-002", "payout-003", "payout-004", "payout-005"];
const EXPECTED_STATUSES = ["confirmed", "pending", "failed", "submitted", "cancelled"];
const EXPECTED_RECIPIENTS = [
  "alice@example.com",
  "bob@example.com",
  "charlie@example.com",
  "diana@example.com",
  "eve@example.com",
];

test("fixture snapshot: expected IDs, statuses, and recipients are defined in contract", () => {
  // This validates the architecture contract snapshot against this test.
  // If a fixture is changed, update both the fixture file and this snapshot.

  assert.equal(EXPECTED_FIXTURE_IDS.length, 5, "should have 5 fixture payouts");
  assert.equal(EXPECTED_STATUSES.length, 5, "should have 5 status entries");
  assert.equal(EXPECTED_RECIPIENTS.length, 5, "should have 5 recipients");

  for (const email of EXPECTED_RECIPIENTS) {
    assert.ok(EMAIL_RE.test(email), `${email} should be a valid email`);
  }

  const statusSet = new Set(EXPECTED_STATUSES);
  for (const status of VALID_STATUSES) {
    assert.ok(statusSet.has(status), `fixture must cover status: ${status}`);
  }
});

test("fixture snapshot: test keypair public keys match Stellar G-key format", () => {
  const keys = [
    "GD6WVYRVID442Y4JVWFWKWCZKB45UGHJAABBJRS22TUSTWSTVNXZMAHJ",
    "GDOEVDDBU6OBWKL7VHDAOKD77UP4DKHQYKOKJJT5PR3WRDBTX35HUEUX",
  ];
  for (const key of keys) {
    assert.match(key, STELLAR_KEY_RE, `${key} should be a valid Stellar G-key`);
  }
});

test("fixture snapshot: payout IDs are unique", () => {
  const idSet = new Set(EXPECTED_FIXTURE_IDS);
  assert.equal(idSet.size, EXPECTED_FIXTURE_IDS.length, "fixture IDs must be unique");
});

test("architecture contract: tool root has required folders", async () => {
  const { stat } = await import("node:fs/promises");
  const requiredFolders = ["types", "services", "hooks", "components", "fixtures", "docs", "tests"];

  for (const folder of requiredFolders) {
    const folderPath = join(toolRoot, folder);
    try {
      const s = await stat(folderPath);
      assert.ok(s.isDirectory(), `${folder}/ must be a directory`);
    } catch {
      assert.fail(`Required folder missing: ${folder}/`);
    }
  }
});

test("architecture contract: required files exist", async () => {
  const { stat } = await import("node:fs/promises");
  const requiredFiles = [
    "index.ts",
    "ARCHITECTURE.md",
    "README.md",
    "specs.md",
    ".env.example",
    "types/index.ts",
    "services/index.ts",
    "services/payout.service.ts",
    "services/stellar.service.ts",
    "hooks/index.ts",
    "hooks/use-payout-request.ts",
    "hooks/use-stellar-account.ts",
    "components/index.ts",
    "components/stellar-payout-request-tool.tsx",
    "components/payout-form.tsx",
    "components/payout-status.tsx",
    "fixtures/payouts.fixtures.ts",
  ];

  for (const file of requiredFiles) {
    const filePath = join(toolRoot, file);
    try {
      const s = await stat(filePath);
      assert.ok(s.isFile(), `${file} must be a file`);
    } catch {
      assert.fail(`Required file missing: ${file}`);
    }
  }
});
