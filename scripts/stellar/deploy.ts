import { parseArgs } from "node:util";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import { resolve, join } from "node:path";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";

const exec = promisify(execCb);

const args = parseArgs({
  options: {
    "network-passphrase": { type: "string" },
    deployer: { type: "string" },
    asset: { type: "string" },
    guard: { type: "string" }, // if we wanted an external guard, but we'll use lifecycle
    "protocol-version": { type: "string" },
    "release-mode": { type: "boolean", default: false },
    network: { type: "string", default: "testnet" }, // e.g. testnet, mainnet
    rpc: { type: "string" }, // optional rpc url
  },
  allowPositionals: false,
});

const { values } = args;

// Safety check
if (values.network === "mainnet" && !values["release-mode"]) {
  console.error("ERROR: Refusing to deploy to mainnet without --release-mode flag.");
  process.exit(1);
}

const networkPassphrase =
  values["network-passphrase"] ||
  (values.network === "testnet" ? "Test SDF Network ; September 2015" : "");

if (!networkPassphrase) {
  console.error("ERROR: --network-passphrase is required.");
  process.exit(1);
}

if (!values.deployer) {
  console.error("ERROR: --deployer (secret key) is required.");
  process.exit(1);
}

const deployerKp = Keypair.fromSecret(values.deployer);
const deployerPubkey = deployerKp.publicKey();

// In a real scenario, we might have an exact asset. For testnet, we can use a dummy or require it.
const asset = values.asset || "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"; // dummy XLM on testnet just as fallback, but user should provide

const contractsDir = resolve(process.cwd(), "contracts/soroban");
const infraDir = resolve(process.cwd(), "infra/stellar");

const contracts = ["policies", "postage", "receipts", "lifecycle"];

async function runCmd(cmd: string, cwd = process.cwd()) {
  console.log(`Running: ${cmd}`);
  try {
    const { stdout, stderr } = await exec(cmd, { cwd });
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

async function getWasmHash(wasmPath: string): Promise<string> {
  const { readFileSync } = await import("node:fs");
  const wasmBuffer = readFileSync(wasmPath);
  return createHash("sha256").update(wasmBuffer).digest("hex");
}

interface DeploymentManifest {
  network: string | undefined;
  networkPassphrase: string;
  protocolVersion: string;
  deployedAt: string;
  contracts: Record<string, { contractId: string; wasmHash: string }>;
  rollbackNotes: string;
}

async function main() {
  console.log("Starting Stellar Soroban Deployment Workflow...");
  console.log(`Network: ${values.network}`);
  console.log(`Deployer: ${deployerPubkey}`);

  // 1. Build
  console.log("\n[1/5] Building contracts...");
  await runCmd("stellar contract build", contractsDir);

  const manifest: DeploymentManifest = {
    network: values.network,
    networkPassphrase,
    protocolVersion: values["protocol-version"] || "v1",
    deployedAt: new Date().toISOString(),
    contracts: {},
    rollbackNotes:
      "To rollback, deploy the previous WASM hashes or use `stellar contract restore` if applicable. Or update the registry to point to older contract IDs.",
  };

  const deployedIds: Record<string, string> = {};

  const networkArgs = `--network-passphrase "${networkPassphrase}" ${
    values.rpc ? `--rpc-url ${values.rpc}` : `--network ${values.network}`
  }`;

  // 2. Optimize & 3. Deploy
  for (const contract of contracts) {
    console.log(`\n[2/5] Optimizing & Deploying ${contract}...`);
    const targetPath = join(contractsDir, `target/wasm32v1-none/release/stealth_${contract}.wasm`);
    const optimizedPath = join(
      contractsDir,
      `target/wasm32v1-none/release/stealth_${contract}.optimized.wasm`,
    );

    await runCmd(`stellar contract optimize --wasm ${targetPath}`, contractsDir);

    const wasmHash = await getWasmHash(optimizedPath);
    console.log(`Optimized ${contract} WASM hash: ${wasmHash}`);

    // Deploy
    // Note: To be purely idempotent, we could check if it exists, but Soroban contract deploy creates a new instance.
    // We will just deploy a new instance for this release workflow.
    const deployCmd = `stellar contract deploy --wasm ${optimizedPath} --source ${values.deployer} ${networkArgs}`;
    const contractId = await runCmd(deployCmd, contractsDir);
    console.log(`Deployed ${contract} to: ${contractId}`);

    deployedIds[contract] = contractId;
    manifest.contracts[contract] = {
      contractId,
      wasmHash,
    };
  }

  // 4. Initialize
  console.log("\n[4/5] Initializing contracts...");

  // Initialize Postage
  // fn initialize(env: Env, asset: Address, treasury: Address, minimum: i128, fee_bps: u32, expiry_seconds: u64, dispute_seconds: u64)
  console.log("Initializing postage...");
  const postageInitCmd = `stellar contract invoke --id ${deployedIds.postage} --source ${values.deployer} ${networkArgs} -- initialize --asset ${asset} --treasury ${deployerPubkey} --minimum 0 --fee_bps 0 --expiry_seconds 86400 --dispute_seconds 86400`;
  await runCmd(postageInitCmd, contractsDir);

  // Initialize Lifecycle
  // fn initialize(env: Env, policies: Address, postage: Address, receipts: Address)
  console.log("Initializing lifecycle...");
  const lifecycleInitCmd = `stellar contract invoke --id ${deployedIds.lifecycle} --source ${values.deployer} ${networkArgs} -- initialize --policies ${deployedIds.policies} --postage ${deployedIds.postage} --receipts ${deployedIds.receipts}`;
  await runCmd(lifecycleInitCmd, contractsDir);

  // Configure Guards
  console.log("Configuring guards...");
  const postageGuardCmd = `stellar contract invoke --id ${deployedIds.postage} --source ${values.deployer} ${networkArgs} -- configure_guard --guard ${deployedIds.lifecycle}`;
  await runCmd(postageGuardCmd, contractsDir);

  const receiptsGuardCmd = `stellar contract invoke --id ${deployedIds.receipts} --source ${values.deployer} ${networkArgs} -- configure_guard --guard ${deployedIds.lifecycle}`;
  await runCmd(receiptsGuardCmd, contractsDir);

  // 5. Record (Generate Signed Manifest)
  console.log("\n[5/5] Generating Signed Manifest...");
  if (!existsSync(infraDir)) {
    mkdirSync(infraDir, { recursive: true });
  }

  const manifestString = JSON.stringify(manifest, null, 2);
  const signature = deployerKp.sign(Buffer.from(manifestString)).toString("base64");

  const signedManifest = {
    ...manifest,
    signature,
    deployerPubkey,
  };

  const manifestPath = join(infraDir, "contract-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(signedManifest, null, 2));

  // Sync to src/config for runtime validation
  const srcConfigDir = resolve(process.cwd(), "src/config");
  if (!existsSync(srcConfigDir)) {
    mkdirSync(srcConfigDir, { recursive: true });
  }
  const srcManifestPath = join(srcConfigDir, "contract-manifest.json");
  writeFileSync(srcManifestPath, JSON.stringify(signedManifest, null, 2));

  console.log(`\nDeployment Complete!`);
  console.log(`Manifest written to: ${manifestPath}`);
  console.log(`Manifest synced to: ${srcManifestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
