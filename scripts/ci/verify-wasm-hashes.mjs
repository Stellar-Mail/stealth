#!/usr/bin/env node
/**
 * BETA-088 — compare built Soroban Wasm hashes to contract-manifest.json.
 *
 * Usage: node scripts/ci/verify-wasm-hashes.mjs [--manifest <path>] [--wasm-dir <path>]
 *
 * CI compares against scripts/ci/expected-wasm-hashes.json (unoptimized cargo
 * output). The signed deploy manifest in infra/stellar/ uses stellar-cli
 * optimized hashes and is not the lockfile for this gate.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const args = process.argv.slice(2);
let manifestPath = join(ROOT, "scripts/ci/expected-wasm-hashes.json");
let wasmDir = join(ROOT, "contracts/soroban/target/wasm32v1-none/release");

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--manifest") manifestPath = args[++i];
  else if (args[i] === "--wasm-dir") wasmDir = args[++i];
}

if (!existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const contracts = Object.keys(manifest.contracts ?? {});

const comparisons = [];
const failures = [];

for (const name of contracts) {
  const wasmPath = join(wasmDir, `stealth_${name}.wasm`);
  const entry = manifest.contracts[name];
  const expected = (typeof entry === "string" ? entry : entry?.wasmHash)?.toLowerCase();

  if (!existsSync(wasmPath)) {
    failures.push({ contract: name, error: `Wasm not found at ${wasmPath}` });
    comparisons.push({ contract: name, status: "fail", error: "wasm missing" });
    continue;
  }

  const built = createHash("sha256").update(readFileSync(wasmPath)).digest("hex");
  const match = built === expected;

  comparisons.push({
    contract: name,
    status: match ? "pass" : "fail",
    expected,
    built,
    contractId: typeof entry === "object" ? entry.contractId : undefined,
  });

  if (!match) {
    failures.push({
      contract: name,
      expected,
      built,
      message: "Built wasm hash does not match scripts/ci/expected-wasm-hashes.json",
    });
    console.error(`❌ ${name}: expected ${expected}, built ${built}`);
  } else {
    console.log(`✅ ${name}: ${built}`);
  }
}

const result = {
  gateId: "contract-registry",
  name: "Contract Registry & Wasm Hashes",
  owner: "platform/contracts",
  dependency: "BETA-086",
  status: failures.length === 0 ? "pass" : "fail",
  manifestPath: manifestPath.replace(/\\/g, "/"),
  network: manifest.network,
  comparisons,
  failures,
  verifiedAt: new Date().toISOString(),
};

const outPath = join(ROOT, "gate-result-contract-registry.json");
writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf-8");
console.log(`Wrote ${outPath}`);

if (failures.length > 0) {
  console.error("\n❌ Wasm hash verification failed.");
  process.exit(1);
}

console.log("\n✅ All wasm hashes match the contract manifest.");
process.exit(0);
