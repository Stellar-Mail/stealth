#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReleaseSummary, renderMarkdown } from "./release-gate-lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);

let inputDir = ROOT;
let commit = process.env.GITHUB_SHA ?? "local";
const forkPr = process.env.FORK_PR === "true";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input-dir") inputDir = args[++i];
  else if (args[i] === "--commit") commit = args[++i];
}

function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

const loadedGates = readdirSync(inputDir)
  .filter((f) => f.startsWith("gate-result-") && f.endsWith(".json"))
  .sort()
  .map((file) => loadJson(join(inputDir, file)))
  .filter(Boolean);

const summary = buildReleaseSummary({
  loadedGates,
  commit,
  toolVersions: loadJson(join(ROOT, "scripts/ci/tool-versions.json")),
  artifactHashes: loadJson(join(inputDir, "artifact-hashes.json")),
  generatedAt: new Date().toISOString(),
  forkPr,
});

const jsonPath = join(inputDir, "release-gate-summary.json");
writeFileSync(jsonPath, JSON.stringify(summary, null, 2) + "\n", "utf-8");

const md = renderMarkdown(summary);
const mdPath = join(inputDir, "release-gate-summary.md");
writeFileSync(mdPath, md, "utf-8");

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
console.log(`\nVerdict: ${summary.verdict.toUpperCase()} (${summary.gates.length} gates)`);

if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, md, "utf-8");
}
