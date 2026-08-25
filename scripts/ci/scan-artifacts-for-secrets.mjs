#!/usr/bin/env node
/**
 * BETA-088 — scan build artifacts for forbidden secret patterns.
 *
 * Usage: node scripts/ci/scan-artifacts-for-secrets.mjs [--dir <path>]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const args = process.argv.slice(2);
let scanDir = join(ROOT, "artifacts");

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--dir") scanDir = args[++i];
}

const FORBIDDEN_PATTERNS = [
  { id: "stellar-secret", re: /\bS[A-Z2-7]{55}\b/g, label: "Stellar secret key (S…)" },
  {
    id: "private-key-pem",
    re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
    label: "PEM private key block",
  },
  { id: "aws-key", re: /\bAKIA[0-9A-Z]{16}\b/g, label: "AWS access key id" },
  { id: "bearer-token", re: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/g, label: "Bearer token" },
  {
    id: "password-assign",
    re: /(?:password|passwd|secret|seed)\s*[:=]\s*['"][^'"\s]{8,}['"]/gi,
    label: "Inline password/secret assignment",
  },
];

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".css",
  ".html",
  ".json",
  ".map",
  ".txt",
  ".md",
  ".wasm",
  ".svg",
]);

const findings = [];

function scanFile(absPath) {
  const rel = relative(ROOT, absPath).replace(/\\/g, "/");
  if (/(^|\/)vendor[-.]/.test(rel) || rel.includes("vendor-stellar")) {
    return;
  }

  const ext = absPath.slice(absPath.lastIndexOf(".")).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return;

  let content;
  try {
    content = readFileSync(absPath, "utf-8");
  } catch {
    return;
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    pattern.re.lastIndex = 0;
    if (pattern.re.test(content)) {
      findings.push({
        file: relative(ROOT, absPath).replace(/\\/g, "/"),
        pattern: pattern.id,
        label: pattern.label,
      });
    }
  }
}

function walk(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs);
    else scanFile(abs);
  }
}

walk(scanDir);

const result = {
  gateId: "artifact-secrets",
  name: "Artifact Secret Scan",
  owner: "security/platform",
  dependency: "BETA-088",
  status: findings.length === 0 ? "pass" : "fail",
  scanDir: scanDir.replace(/\\/g, "/"),
  findings,
  verifiedAt: new Date().toISOString(),
};

const outPath = join(ROOT, "gate-result-artifact-secrets.json");
writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf-8");

if (findings.length > 0) {
  console.error("❌ Forbidden secret patterns detected in artifacts:");
  for (const f of findings) {
    console.error(`   ${f.file}: ${f.label}`);
  }
  process.exit(1);
}

console.log(`✅ No forbidden secret patterns in ${scanDir}`);
process.exit(0);
