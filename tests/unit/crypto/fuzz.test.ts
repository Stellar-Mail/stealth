/**
 * BETA-085 (#1992) — Bounded parser fuzzing within CI limits.
 *
 * Mutates envelope, key-directory, attachment, and signer-intent inputs and
 * asserts every failure path is typed and never returns private key material.
 */
import { describe, expect, it } from "vitest";
import corpus from "../../fixtures/crypto-misuse-corpus.json";
import { sealedEnvelopeSchema } from "../../../src/services/crypto/schema";
import { keyDirectoryRecordSchema } from "../../../src/server/api/domain";
import { attachmentMetadataSchema } from "../../../src/server/api/envelope";
import {
  validateIntent,
  type ManagedWalletIntent,
} from "../../../src/server/api/authorization/intents";
import { assertNoSecretsLeaked } from "../../fixtures/identity";
import type { BetaRuntimeConfig } from "../../../src/config/schema";
import { Keypair } from "@stellar/stellar-sdk";

const ITERATIONS = corpus.boundedIterations;

function randomString(maxLen: number): string {
  const len = Math.floor(Math.random() * maxLen) + 1;
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let out = "";
  for (let i = 0; i < len; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function randomObject(depth = 2): unknown {
  if (depth <= 0) return randomString(16);
  const keys = Math.floor(Math.random() * 5) + 1;
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < keys; i += 1) obj[randomString(8)] = randomObject(depth - 1);
  return obj;
}

const betaConfig: BetaRuntimeConfig = {
  network: {
    stellarNetwork: "testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "http://localhost",
  },
  contract: {
    registryContractId: "C",
    postageContractId: "C",
    lifecycleContractId: "C",
    receiptsContractId: "C",
    policiesContractId: "C",
    domainTag: "test",
    protocolVersion: "1",
  },
  environment: "beta",
} as unknown as BetaRuntimeConfig;

describe("BETA-085 bounded parser fuzz (#1992)", () => {
  it(`sealedEnvelopeSchema rejects ${ITERATIONS} random inputs without throwing unexpectedly`, () => {
    let rejections = 0;
    for (let i = 0; i < ITERATIONS; i += 1) {
      const input = randomObject(3);
      const result = sealedEnvelopeSchema.safeParse(input);
      if (!result.success) {
        rejections += 1;
        assertNoSecretsLeaked(JSON.stringify(result.error.issues.slice(0, 2)));
      }
    }
    expect(rejections).toBe(ITERATIONS);
  });

  it(`keyDirectoryRecordSchema rejects ${ITERATIONS} random inputs`, () => {
    let rejections = 0;
    for (let i = 0; i < ITERATIONS; i += 1) {
      const result = keyDirectoryRecordSchema.safeParse(randomObject(3));
      if (!result.success) {
        rejections += 1;
        assertNoSecretsLeaked(result.error.message);
      }
    }
    expect(rejections).toBe(ITERATIONS);
  });

  it(`attachmentMetadataSchema rejects ${ITERATIONS} random inputs`, () => {
    let rejections = 0;
    for (let i = 0; i < ITERATIONS; i += 1) {
      const result = attachmentMetadataSchema.safeParse(randomObject(2));
      if (!result.success) {
        rejections += 1;
        assertNoSecretsLeaked(result.error.message);
      }
    }
    expect(rejections).toBe(ITERATIONS);
  });

  it(`validateIntent rejects malformed signer intents (${ITERATIONS} samples)`, () => {
    const actor = Keypair.random().publicKey();
    let rejections = 0;
    for (let i = 0; i < ITERATIONS; i += 1) {
      const garbage = randomObject(2) as ManagedWalletIntent;
      try {
        validateIntent(garbage, actor, betaConfig);
      } catch (err) {
        rejections += 1;
        assertNoSecretsLeaked(String(err));
      }
    }
    expect(rejections).toBe(ITERATIONS);
  });

  it("refuses mainnet signing even with a valid-looking intent", () => {
    const actor = Keypair.random().publicKey();
    const mainnetConfig = {
      ...betaConfig,
      network: { ...betaConfig.network, stellarNetwork: "mainnet" as const },
    };
    expect(() =>
      validateIntent({ type: "policy", ownerAddress: actor }, actor, mainnetConfig),
    ).toThrow(/mainnet/);
  });
});
