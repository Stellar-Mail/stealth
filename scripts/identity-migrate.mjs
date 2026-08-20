#!/usr/bin/env node
/**
 * BETA-024 (Issue #1931) — identity migration CLI.
 *
 * Runs the schema-governance commands (dry-run / forward / rollback /
 * integrity-check) against a local Cloudflare emulation of the durable
 * identity records (users, sessions, usernames, verification, wallet
 * metadata) using the repository's own migration worker. Records persist
 * under `.wrangler/state/migrations`, so commands are restartable and
 * forward/rollback operate on the same emulated store across invocations.
 *
 * Usage:
 *   node scripts/identity-migrate.mjs dry-run [--family <name>]
 *   node scripts/identity-migrate.mjs forward [--family <name>]
 *   node scripts/identity-migrate.mjs rollback --target-version <n> [--family <name>]
 *   node scripts/identity-migrate.mjs integrity-check [--family <name>]
 */
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const WORKER = join(ROOT, "src", "server", "migrations", "worker.ts");
const DEFAULT_PERSIST = join(ROOT, ".wrangler", "state", "migrations");

const args = process.argv.slice(2);
const command = args.shift();
if (!["dry-run", "forward", "rollback", "integrity-check"].includes(command ?? "")) {
  console.error(
    "Usage: identity-migrate.mjs <dry-run|forward|rollback|integrity-check> [--family <name>] [--target-version <n>]",
  );
  process.exit(1);
}

const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--family") options.family = args[++i];
  else if (args[i] === "--target-version") options.targetVersion = Number(args[++i]);
}

if (
  command === "rollback" &&
  (!Number.isInteger(options.targetVersion) || options.targetVersion < 1)
) {
  console.error("rollback requires --target-version <positive integer>");
  process.exit(1);
}

console.log(`✦ Identity migrations — command: ${command}`);
if (options.family) console.log(`  family:            ${options.family}`);
if (options.targetVersion) console.log(`  target version:    ${options.targetVersion}`);

const result = await build({
  entryPoints: [WORKER],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["cloudflare:workers"],
  write: false,
  logLevel: "silent",
});
const code = result.outputFiles[0].text;

const mf = new Miniflare({
  // A stable `name` is required so separate CLI invocations (and any seeding
  // harness using the same name) share the persisted emulated store.
  name: "stealth-migrations",
  modules: true,
  script: code,
  compatibilityDate: "2025-09-24",
  compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STEALTH_COORDINATOR: "StealthCoordinator" },
  kvNamespaces: { STEALTH_KV: "local-emulation-kv" },
  durableObjectsPersist: DEFAULT_PERSIST,
});

try {
  const res = await mf.dispatchFetch("http://localhost/migrate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command, options }),
  });
  const report = await res.json();

  console.log(`  generated at:      ${report.generatedAt}`);
  console.log("");
  for (const family of report.families) {
    const line = [
      `[${family.family}]`,
      `total=${family.totalKeys}`,
      `forwardPending=${family.forwardPending}`,
      `changed=${family.changed}`,
      `skipped=${family.skipped}`,
      `failed=${family.failed}`,
    ].join("  ");
    console.log(`  ${line}`);
    for (const error of family.errors) console.log(`      ✖ ${error}`);
    for (const issue of family.issues) console.log(`      ⚠ ${issue.kind} @ ${issue.key}`);
  }

  console.log("");
  console.log(
    report.ok ? "✓ Migration command completed." : "✖ Migration command reported problems.",
  );
  process.exit(report.ok ? 0 : 1);
} finally {
  await mf.dispose();
}
