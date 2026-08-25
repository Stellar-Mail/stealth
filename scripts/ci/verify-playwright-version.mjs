#!/usr/bin/env node
/**
 * Fail when the installed Playwright packages do not match scripts/ci/tool-versions.json.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(join(ROOT, "package.json"));

export function readInstalledPlaywrightVersion(resolveFn = require.resolve) {
  const pkgPath = resolveFn("@playwright/test/package.json");
  return JSON.parse(readFileSync(pkgPath, "utf-8")).version;
}

export function assertPlaywrightPin({ pinned, installed, runnerBin }) {
  if (!pinned) {
    return { ok: false, message: "Missing Playwright pin in scripts/ci/tool-versions.json" };
  }
  if (!installed) {
    return { ok: false, message: "Could not resolve installed @playwright/test version" };
  }
  if (pinned !== installed) {
    return {
      ok: false,
      message: `Playwright pin ${pinned} does not match installed @playwright/test ${installed}`,
    };
  }
  if (runnerBin && !existsSync(runnerBin) && !existsSync(`${runnerBin}.cmd`)) {
    return { ok: false, message: `Locked Playwright binary missing at ${runnerBin}` };
  }
  return { ok: true, message: `Playwright ${installed} matches pin and local binary` };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const pinned = JSON.parse(
    readFileSync(join(ROOT, "scripts/ci/tool-versions.json"), "utf-8"),
  ).playwright;
  let installed;
  try {
    installed = readInstalledPlaywrightVersion();
  } catch {
    installed = null;
  }
  const runnerBin = join(ROOT, "node_modules", ".bin", "playwright");
  const result = assertPlaywrightPin({ pinned, installed, runnerBin });
  console.log(result.message);
  process.exit(result.ok ? 0 : 1);
}
