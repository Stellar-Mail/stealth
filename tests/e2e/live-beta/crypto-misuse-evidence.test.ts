/**
 * BETA-085 (#1992) — Live-beta crypto misuse evidence (local-fake).
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { Keypair, StrKey, TransactionBuilder, Account, Contract } from "@stellar/stellar-sdk";
import {
  MemoryManagedWalletStore,
  VersionedMasterKeyProvider,
  sealManagedWalletSeed,
  withManagedWalletSeed,
  ManagedWalletCryptoError,
} from "@/services/crypto/managed-wallet-envelope";
import { ManagedWalletService } from "@/services/stellar/managed-wallet";
import type { BetaRuntimeConfig } from "@/config/schema";
import { assertNoSecretsLeaked } from "../../fixtures/identity";

const REPORT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "crypto-misuse-run-report.json",
);

interface MisuseStep {
  step: string;
  status: "pass" | "fail" | "denied";
  controlOwner: string;
}

function writeReport(steps: MisuseStep[]) {
  const report = {
    issue: "BETA-085",
    runAt: new Date().toISOString(),
    mode: "local-fake",
    network: "local",
    toolVersions: { vitest: "4.x", node: process.version },
    steps,
  };
  assertNoSecretsLeaked(JSON.stringify(report));
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf-8");
}

async function masterKeys() {
  return VersionedMasterKeyProvider.fromBase64("v1", {
    v1: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
  });
}

function walletConfig(contractId: string): BetaRuntimeConfig {
  return {
    network: {
      stellarNetwork: "testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "http://localhost",
    },
    contract: {
      registryContractId: contractId,
      postageContractId: contractId,
      policiesContractId: contractId,
      receiptsContractId: contractId,
      domainTag: "beta-085",
      protocolVersion: "1",
    },
    environment: "beta",
    secrets: {},
  } as unknown as BetaRuntimeConfig;
}

describe("BETA-085 (Issue #1992): Live-Beta Crypto Misuse Evidence", () => {
  const steps: MisuseStep[] = [];
  const contractId = StrKey.encodeContract(Buffer.alloc(32, 9));

  afterAll(() => writeReport(steps));

  it("denies keys-directory signing attempts (fail-closed)", async () => {
    const actor = Keypair.random();
    const config = walletConfig(contractId);
    const service = new ManagedWalletService(config, {
      store: new MemoryManagedWalletStore(),
      keys: await masterKeys(),
    });
    await service.provisionWallet(actor.publicKey(), actor.secret());

    const tx = new TransactionBuilder(new Account(actor.publicKey(), "1"), {
      fee: "100",
      networkPassphrase: config.network.networkPassphrase,
    })
      .addOperation(new Contract(contractId).call("set_policy"))
      .setTimeout(30)
      .build()
      .toXDR();

    await expect(
      service.signTransaction(
        { type: "keys", ownerAddress: actor.publicKey(), operation: "publish" },
        actor.publicKey(),
        tx,
      ),
    ).rejects.toThrow(/key directory/i);

    steps.push({ step: "keys-intent-denied", status: "denied", controlOwner: "managed-wallet" });
  });

  it("denies tampered managed-wallet envelope unwrap", async () => {
    const seed = Keypair.random().secret();
    const address = Keypair.fromSecret(seed).publicKey();
    const provider = await masterKeys();
    const envelope = await sealManagedWalletSeed(seed, address, provider);

    await expect(
      withManagedWalletSeed(
        { ...envelope, seedTag: "AAAAAAAAAAAAAAAAAAAAAA==" },
        provider,
        () => "x",
      ),
    ).rejects.toBeInstanceOf(ManagedWalletCryptoError);

    steps.push({
      step: "tampered-envelope-denied",
      status: "denied",
      controlOwner: "managed-wallet-envelope",
    });
  });

  it("records successful seal without persisting plaintext seed", async () => {
    const seed = Keypair.random().secret();
    const address = Keypair.fromSecret(seed).publicKey();
    const envelope = await sealManagedWalletSeed(seed, address, await masterKeys());
    expect(JSON.stringify(envelope)).not.toContain(seed);
    assertNoSecretsLeaked(JSON.stringify(envelope));

    steps.push({
      step: "seal-success-no-plaintext",
      status: "pass",
      controlOwner: "managed-wallet-envelope",
    });
  });
});
