import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

describe("Deployment Script Constraints", () => {
  const scriptPath = resolve(process.cwd(), "scripts/stellar/deploy.ts");

  // Node v22+ supports native TypeScript via --experimental-strip-types.
  // This avoids a hard dependency on the `tsx` binary which may not be
  // present in all CI environments.
  const nodeArgs = ["--experimental-strip-types", scriptPath];

  it("fails if mainnet is used without release-mode", { timeout: 60000 }, async () => {
    try {
      await execFileAsync(process.execPath, [
        ...nodeArgs,
        "--network",
        "mainnet",
        "--deployer",
        "SECRET",
        "--network-passphrase",
        "Public Global Stellar Network ; September 2015",
      ]);
      expect.fail("Should have failed on mainnet without --release-mode");
    } catch (err: any) {
      expect(err.stderr || err.stdout).toContain(
        "Refusing to deploy to mainnet without --release-mode flag",
      );
      expect(err.code).toBe(1);
    }
  });

  it("fails if deployer is missing", { timeout: 60000 }, async () => {
    try {
      await execFileAsync(process.execPath, [...nodeArgs, "--network", "testnet"]);
      expect.fail("Should have failed without deployer");
    } catch (err: any) {
      expect(err.stderr || err.stdout).toContain("--deployer (secret key) is required");
      expect(err.code).toBe(1);
    }
  });

  // Since it executes stellar-cli, testing further requires mocking or actually having the CLI installed
});
