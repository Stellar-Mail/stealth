import { parseArgs } from "node:util";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import { resolve, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

const exec = promisify(execCb);

const args = parseArgs({
  options: {
    manifest: { type: "string" }, // optional path to manifest
    network: { type: "string", default: "testnet" },
    rpc: { type: "string" },
  },
  allowPositionals: false,
});

const { values } = args;

const defaultManifestPath = resolve(process.cwd(), "infra/stellar/contract-manifest.json");
const manifestPath = values.manifest || defaultManifestPath;

if (!existsSync(manifestPath)) {
  console.error(`ERROR: Manifest not found at ${manifestPath}`);
  process.exit(1);
}

interface ContractInfo {
  contractId: string;
  hash: string;
}

interface Manifest {
  network: string;
  deployedAt: string;
  contracts: Record<string, ContractInfo>;
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;

console.log(`Loaded manifest from ${manifest.deployedAt}`);
console.log(`Network: ${manifest.network}`);

async function runCmd(cmd: string) {
  console.log(`Running: ${cmd}`);
  try {
    const { stdout, stderr } = await exec(cmd);
    if (stderr && !stderr.includes("warning")) {
      console.warn(`Stderr: ${stderr}`);
    }
    return stdout.trim();
  } catch (err: unknown) {
    console.error(`Command failed: ${cmd}`);
    console.error((err as { stdout: string }).stdout);
    console.error((err as { stderr: string }).stderr);
    throw err;
  }
}

async function smokeTest() {
  const contracts = manifest.contracts;
  const networkArgs = `--network ${values.network} ${values.rpc ? `--rpc-url ${values.rpc}` : ""}`;

  console.log("\n[1/4] Verifying Policies Contract...");
  // Test by calling a read-only function, assuming address exists in args if required, but we can just invoke it with dummy if it fails normally.
  // Actually, we can just use `stellar contract read` or `stellar contract invoke`.
  // Wait, `stellar contract invoke` requires an identity.
  // Maybe it's easier to check if the contract has Wasm logic via stellar API, or just fetch the contract code.
  // We can use `stellar-sdk` to fetch the contract code hash.
  const { rpc, Contract } = await import("@stellar/stellar-sdk");
  const serverUrl =
    values.rpc ||
    (values.network === "mainnet"
      ? "https://soroban-rpc.mainnet.stellar.org"
      : "https://soroban-testnet.stellar.org");
  const server = new rpc.Server(serverUrl);

  for (const [name, info] of Object.entries(contracts)) {
    console.log(`\nVerifying ${name} contract at ${info.contractId}`);
    try {
      const contractId = info.contractId;
      const ledgerEntry = await server.getLedgerEntries(new Contract(contractId).getFootprint());

      if (!ledgerEntry || ledgerEntry.entries.length === 0) {
        throw new Error(`Contract not found on-chain: ${contractId}`);
      }

      console.log(`✅ ${name} contract exists and is active on-chain.`);
    } catch (err) {
      console.error(`❌ Failed to verify ${name} contract.`);
      console.error(err);
      process.exit(1);
    }
  }

  console.log("\n✅ All contracts verified successfully!");
}

smokeTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
