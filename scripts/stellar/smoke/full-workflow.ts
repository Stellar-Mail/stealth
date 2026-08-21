/**
 * Full Workflow 2 smoke test (BETA-050 / #1957).
 *
 * Extends the basic contract-availability check in smoke-test.ts to include
 * the complete Alice→Bob message round-trip. Requires funded testnet accounts.
 *
 * Usage (all env vars required for live run):
 *   STEALTH_DEPLOYER_SECRET=S... \
 *   STEALTH_ALICE_SECRET=S... \
 *   STEALTH_BOB_SECRET=S... \
 *   STEALTH_RELAY_ENDPOINT=https://your-relay.com/api/v1/relay/messages \
 *   npx tsx scripts/stellar/smoke/full-workflow.ts [--manifest path] [--network testnet]
 *
 * In dry-run mode (no secrets), only contract availability is checked.
 * The redacted run report is written to scripts/stellar/smoke/smoke-report.json.
 */

import { parseArgs } from "node:util";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execFile = promisify(execFileCallback);

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = parseArgs({
  options: {
    manifest: { type: "string" },
    network: { type: "string", default: "testnet" },
    rpc: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
  allowPositionals: false,
});

const { values } = args;

const defaultManifestPath = resolve(process.cwd(), "infra/stellar/contract-manifest.json");
const manifestPath = values.manifest ?? defaultManifestPath;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractInfo {
  contractId: string;
  wasmHash: string;
}
interface Manifest {
  network: string;
  deployedAt: string;
  contracts: Record<string, ContractInfo>;
}

interface SmokeStep {
  step: string;
  status: "ok" | "failed" | "skipped" | "dry-run";
  detail?: Record<string, unknown>;
  errorMessage?: string;
}

interface SmokeReport {
  runAt: string;
  network: string;
  mode: "live" | "dry-run";
  steps: SmokeStep[];
  transactionHashes?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshMessageId(): string {
  const { randomBytes } = (await import("node:crypto")) as never;
  const bytes = (randomBytes as (n: number) => Buffer)(32);
  return bytes.toString("hex");
}

const SERVER_URL =
  values.rpc ??
  (values.network === "mainnet"
    ? "https://soroban-rpc.mainnet.stellar.org"
    : "https://soroban-testnet.stellar.org");

// ---------------------------------------------------------------------------
// Stage 1: Contract availability (mirrors smoke-test.ts)
// ---------------------------------------------------------------------------

async function checkContracts(manifest: Manifest, report: SmokeReport): Promise<boolean> {
  const { rpc, Contract } = await import("@stellar/stellar-sdk");
  const server = new rpc.Server(SERVER_URL);

  console.log("\n[Stage 1] Verifying deployed contracts...");
  for (const [name, info] of Object.entries(manifest.contracts)) {
    const step: SmokeStep = { step: `contract-${name}`, status: "ok" };
    try {
      const entry = await server.getLedgerEntries(new Contract(info.contractId).getFootprint());
      if (!entry || entry.entries.length === 0) throw new Error("Contract not found on-chain");
      console.log(`  ✅ ${name} (${info.contractId})`);
      step.detail = { contractId: info.contractId, wasmHash: info.wasmHash };
    } catch (err) {
      step.status = "failed";
      step.errorMessage = String(err);
      console.error(`  ❌ ${name}: ${String(err)}`);
      report.steps.push(step);
      return false;
    }
    report.steps.push(step);
  }
  return true;
}

/**
 * Invokes Soroban without ever putting an account secret into logs. The Stellar
 * CLI signs and submits the transaction with the supplied source key; only the
 * public contract id and transaction output are retained in the run report.
 */
async function invokeContract(
  contractId: string,
  sourceSecret: string,
  args: string[],
): Promise<string> {
  const { stdout } = await execFile(
    "stellar",
    [
      "contract",
      "invoke",
      "--id",
      contractId,
      "--source",
      sourceSecret,
      "--network-passphrase",
      "Test SDF Network ; September 2015",
      "--rpc-url",
      SERVER_URL,
      "--",
      ...args,
    ],
    { maxBuffer: 1024 * 1024 },
  );
  return stdout.trim();
}

function transactionReference(output: string): string | undefined {
  return output.match(/\b[0-9a-f]{64}\b/i)?.[0];
}

// ---------------------------------------------------------------------------
// Stage 2: Alice→Bob message round-trip (live only)
// ---------------------------------------------------------------------------

async function liveRoundTrip(
  manifest: Manifest,
  report: SmokeReport,
  aliceSecret: string,
  bobSecret: string,
  relayEndpoint: string,
): Promise<void> {
  console.log("\n[Stage 2] Live Alice→Bob round-trip...");

  const { Keypair } = await import("@stellar/stellar-sdk");
  const aliceKp = Keypair.fromSecret(aliceSecret);
  const bobKp = Keypair.fromSecret(bobSecret);
  const aliceAddr = aliceKp.publicKey();
  const bobAddr = bobKp.publicKey();

  // Dynamic imports of local modules (TypeScript path aliases resolved at runtime via tsx)
  const { sealEnvelope } = await import("../../../src/services/crypto/envelope.js");
  const { openEnvelope, OpenEnvelopeError, WrappedKeyProvider } =
    await import("../../../src/services/crypto/open-envelope.js");
  const { generateRecipientKeyPair } = await import("../../../src/services/crypto/key-wrap.js");
  const { submitToRelay } = await import("../../../src/services/relay/submit.js");

  // 1. Generate Bob's encryption key pair (fresh per run — simulates key directory)
  const bobEncKp = await generateRecipientKeyPair();
  report.steps.push({ step: "key-generation", status: "ok" });

  // 2. Seal
  const messageIdBytes = new Uint8Array(32);
  crypto.getRandomValues(messageIdBytes);
  const messageId = Array.from(messageIdBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const plaintext = `Smoke test — Workflow 2 — ${new Date().toISOString()}`;

  const sealed = await sealEnvelope({
    sender: aliceAddr,
    recipient: bobAddr,
    body: plaintext,
    recipientPublicKeys: [bobEncKp.publicKeySpkiBase64],
  });
  report.steps.push({
    step: "seal-envelope",
    status: "ok",
    detail: {
      commitment: sealed.payload.content_commitment,
      wrappedKeys: sealed.payload.wrapped_keys?.length ?? 0,
    },
  });
  console.log(`  ✅ Envelope sealed  commitment=${sealed.payload.content_commitment}`);

  // 3. Submit to relay
  const relayDomain = new URL(relayEndpoint).hostname;
  const payloadStr = JSON.stringify({ payload: sealed.payload, ciphertext: sealed.ciphertext });

  const result = await submitToRelay(
    {
      messageId,
      sender: aliceAddr,
      recipient: bobAddr,
      recipientDomain: relayDomain,
      payload: payloadStr,
    },
    {
      resolveRelay: async () => ({ domain: relayDomain, endpoint: relayEndpoint, publicKey: "" }),
    },
  );
  if (!result.delivered) {
    report.steps.push({
      step: "relay-submit",
      status: "failed",
      detail: { state: result.state, errorCode: result.errorCode },
    });
    throw new Error(`Relay submit failed: ${result.state} / ${result.errorCode ?? "unknown"}`);
  }
  report.steps.push({
    step: "relay-submit",
    status: "ok",
    detail: { state: result.state, attempts: result.attempts },
  });
  console.log(`  ✅ Relay submit OK  state=${result.state}  attempts=${result.attempts}`);

  // 4. Fetch Bob's queue
  const origin = new URL(relayEndpoint).origin;
  const queueResp = await fetch(`${origin}/api/v1/relay/queue/${bobAddr}`, {
    headers: { "x-stealth-address": bobAddr },
  });
  if (!queueResp.ok) {
    report.steps.push({
      step: "relay-queue-fetch",
      status: "failed",
      detail: { status: queueResp.status },
    });
    throw new Error(`Relay queue fetch failed: HTTP ${queueResp.status}`);
  }
  const queueData = (await queueResp.json()) as {
    items?: Array<{ messageId: string; payload: string }>;
  };
  const item = (queueData.items ?? []).find((e) => e.messageId === messageId);
  if (!item) {
    report.steps.push({ step: "relay-queue-fetch", status: "failed", detail: { messageId } });
    throw new Error("Message not found in Bob's relay queue");
  }
  report.steps.push({ step: "relay-queue-fetch", status: "ok" });
  console.log(`  ✅ Message found in Bob's relay queue`);

  // 5. Decrypt
  const parsedPayload = JSON.parse(item.payload) as { payload: unknown; ciphertext: unknown };
  const provider = new WrappedKeyProvider(bobEncKp.privateKeyPkcs8Base64);
  const opened = await openEnvelope(parsedPayload, provider);
  if (opened.body !== plaintext) {
    report.steps.push({ step: "decrypt", status: "failed" });
    throw new Error("Decrypted body does not match original plaintext");
  }
  report.steps.push({ step: "decrypt", status: "ok" });
  console.log(`  ✅ Decryption succeeded — plaintext matches`);

  // 6. Verify Alice cannot decrypt (wrong key rejection)
  const aliceEncKp = await generateRecipientKeyPair();
  const aliceProvider = new WrappedKeyProvider(aliceEncKp.privateKeyPkcs8Base64);
  let wrongKeyRejected = false;
  try {
    await openEnvelope(parsedPayload, aliceProvider);
  } catch (err) {
    if (err instanceof OpenEnvelopeError) wrongKeyRejected = true;
  }
  if (!wrongKeyRejected) {
    report.steps.push({ step: "wrong-key-rejection", status: "failed" });
    throw new Error("Alice should NOT be able to decrypt Bob's ciphertext");
  }
  report.steps.push({ step: "wrong-key-rejection", status: "ok" });
  console.log(`  ✅ Wrong-key rejection verified (Alice cannot decrypt Bob's message)`);

  // 7. Publish the actual delivered/read proofs and settle required postage.
  // The deployed lifecycle guard requires the message to be bound before the
  // escrow and receipt calls, so all state transitions are exercised here.
  const { policies, postage, receipts, lifecycle } = manifest.contracts;
  if (!postage || !receipts || !lifecycle) {
    throw new Error(
      "Workflow 2 requires postage, receipts, and lifecycle contracts in the manifest",
    );
  }
  const payloadHash = sealed.payload.content_commitment.replace(/^v1:sha256:hex:/, "");
  const amount = "1";
  await invokeContract(lifecycle.contractId, aliceSecret, [
    "bind",
    "--message_id",
    messageId,
    "--owner",
    bobAddr,
    "--sender",
    aliceAddr,
    "--recipient",
    bobAddr,
    "--amount",
    amount,
    "--verified",
    "false",
    "--receipt_required",
    "true",
  ]);
  const postageOutput = await invokeContract(postage.contractId, aliceSecret, [
    "submit",
    "--message_id",
    messageId,
    "--sender",
    aliceAddr,
    "--recipient",
    bobAddr,
    "--amount",
    amount,
  ]);
  const deliveredOutput = await invokeContract(receipts.contractId, aliceSecret, [
    "delivered",
    "--message_id",
    messageId,
    "--payload_hash",
    payloadHash,
    "--protocol_version",
    "1",
    "--sender",
    aliceAddr,
    "--recipient",
    bobAddr,
  ]);
  const readOutput = await invokeContract(receipts.contractId, bobSecret, [
    "read",
    "--message_id",
    messageId,
  ]);
  await invokeContract(postage.contractId, bobSecret, ["settle", "--message_id", messageId]);
  report.transactionHashes = {
    ...(transactionReference(postageOutput)
      ? { postageSubmit: transactionReference(postageOutput)! }
      : {}),
    ...(transactionReference(deliveredOutput)
      ? { deliveredReceipt: transactionReference(deliveredOutput)! }
      : {}),
    ...(transactionReference(readOutput) ? { readReceipt: transactionReference(readOutput)! } : {}),
  };
  report.steps.push({
    step: "soroban-postage-delivered-read-receipts",
    status: "ok",
    detail: { postageContractId: postage.contractId, receiptsContractId: receipts.contractId },
  });
  console.log(
    "  ✓ Postage escrow, delivered receipt, read receipt, and settlement confirmed on testnet",
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const report: SmokeReport = {
    runAt: new Date().toISOString(),
    network: String(values.network ?? "testnet"),
    mode: values["dry-run"] ? "dry-run" : "live",
    steps: [],
  };

  // Load manifest
  if (!existsSync(manifestPath)) {
    console.error(`ERROR: Manifest not found at ${manifestPath}`);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
  console.log(`Loaded manifest — network: ${manifest.network}  deployedAt: ${manifest.deployedAt}`);

  // Stage 1: contract availability (always)
  const contractsOk = await checkContracts(manifest, report);
  if (!contractsOk) {
    writeReport(report);
    process.exit(1);
  }

  // Stage 2: message round-trip (only in live mode with secrets)
  const aliceSecret = process.env.STEALTH_ALICE_SECRET;
  const bobSecret = process.env.STEALTH_BOB_SECRET;
  const relayEndpoint = process.env.STEALTH_RELAY_ENDPOINT;

  if (values["dry-run"]) {
    console.log("\n[Stage 2] Skipped (--dry-run)");
    report.steps.push({ step: "round-trip", status: "dry-run" });
  } else if (!aliceSecret || !bobSecret || !relayEndpoint) {
    console.warn(
      "\n[Stage 2] Skipped — set STEALTH_ALICE_SECRET, STEALTH_BOB_SECRET, and STEALTH_RELAY_ENDPOINT to run the live round-trip.",
    );
    report.steps.push({
      step: "round-trip",
      status: "skipped",
      detail: {
        reason:
          "missing env vars: STEALTH_ALICE_SECRET / STEALTH_BOB_SECRET / STEALTH_RELAY_ENDPOINT",
      },
    });
  } else {
    try {
      await liveRoundTrip(manifest, report, aliceSecret, bobSecret, relayEndpoint);
    } catch (err) {
      console.error(`\n❌ Stage 2 failed: ${String(err)}`);
      writeReport(report);
      process.exit(1);
    }
  }

  writeReport(report);
  console.log("\n✅ Smoke test passed — report written to smoke-report.json");
}

function writeReport(report: SmokeReport): void {
  const reportPath = resolve(__dirname, "smoke-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf-8");
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
