#!/usr/bin/env node
/**
 * BETA-088 — collect SHA-256 hashes from CI artifact directories only.
 *
 * Usage: node scripts/ci/collect-artifact-hashes.mjs [--client-dir <path>] [--wasm-dir <path>] [--out <path>]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const args = process.argv.slice(2);
let clientDir = join(ROOT, "artifacts/client-dist");
let wasmDir = join(ROOT, "artifacts/contract-wasm");
let outPath = join(ROOT, "SHA256SUMS");
let jsonOut = join(ROOT, "artifact-hashes.json");

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--client-dir") clientDir = args[++i];
  else if (args[i] === "--wasm-dir") wasmDir = args[++i];
  else if (args[i] === "--out") outPath = args[++i];
  else if (args[i] === "--json-out") jsonOut = args[++i];
}

function hashFile(absPath) {
  const hash = createHash("sha256").update(readFileSync(absPath)).digest("hex");
  const rel = relative(ROOT, absPath).replace(/\\/g, "/");
  return { path: rel, hash, bytes: statSync(absPath).size };
}

function collectDir(dir, filter) {
  const entries = [];
  if (!existsSync(dir)) {
    console.warn(`⚠ Directory missing (skipped): ${dir}`);
    return entries;
  }

  function walk(current) {
    for (const name of readdirSync(current)) {
      const abs = join(current, name);
      const st = statSync(abs);
      if (st.isDirectory()) {
        walk(abs);
      } else if (!filter || filter(abs)) {
        entries.push(hashFile(abs));
      }
    }
  }

  walk(dir);
  return entries;
}

const clientHashes = collectDir(clientDir, (p) =>
  /\.(html|js|css|wasm|json|svg|png|ico|woff2?)$/i.test(p),
);
const wasmHashes = collectDir(wasmDir, (p) => p.endsWith(".wasm"));

const all = [...clientHashes, ...wasmHashes].sort((a, b) => a.path.localeCompare(b.path));

if (all.length === 0) {
  console.error("❌ No artifacts found to hash.");
  process.exit(1);
}

const lines = all.map(({ hash, path }) => `${hash}  ${path}`);
writeFileSync(outPath, lines.join("\n") + "\n", "utf-8");

const payload = {
  collectedAt: new Date().toISOString(),
  clientArtifactCount: clientHashes.length,
  wasmArtifactCount: wasmHashes.length,
  artifacts: all,
};
writeFileSync(jsonOut, JSON.stringify(payload, null, 2) + "\n", "utf-8");

console.log(`✅ Hashed ${all.length} artifacts`);
console.log(`   ${outPath}`);
console.log(`   ${jsonOut}`);

for (const { path, hash } of all) {
  console.log(`   ${hash.slice(0, 12)}…  ${path}`);
}
