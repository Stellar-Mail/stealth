import { describe, expect, it } from "vitest";
import { validateIntent } from "../../../../src/server/api/authorization/intents";
import type { BetaRuntimeConfig } from "../../../../src/config/schema";

describe("Authorization Intents Validation", () => {
  const mockConfig: BetaRuntimeConfig = {
    network: {
      stellarNetwork: "testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "http://localhost",
    },
    secrets: {
      operatorSecret: "SAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    },
    contracts: {
      policies: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      postage: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      registry: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    },
    environment: "beta",
  } as any;

  it("refuses mainnet configuration", () => {
    const mainnetConfig = {
      ...mockConfig,
      network: { ...mockConfig.network, stellarNetwork: "mainnet" },
    };
    expect(() =>
      validateIntent({ type: "policy", ownerAddress: "G_ACTOR" }, "G_ACTOR", mainnetConfig as any),
    ).toThrow("Refusing to sign mainnet transactions in beta configuration");
  });

  it("validates actor ownership for policy intents", () => {
    expect(validateIntent({ type: "policy", ownerAddress: "G_ACTOR" }, "G_ACTOR", mockConfig)).toBe(
      true,
    );
    expect(() =>
      validateIntent({ type: "policy", ownerAddress: "G_OTHER" }, "G_ACTOR", mockConfig),
    ).toThrow("Actor mismatch");
  });

  it("validates ceilings for postage intents", () => {
    // Under ceiling (100 XLM max)
    expect(
      validateIntent(
        { type: "postage", senderAddress: "G_ACTOR", amountStroops: "100000000" },
        "G_ACTOR",
        mockConfig,
      ),
    ).toBe(true);

    // Over ceiling
    expect(() =>
      validateIntent(
        { type: "postage", senderAddress: "G_ACTOR", amountStroops: "2000000000" },
        "G_ACTOR",
        mockConfig,
      ),
    ).toThrow("Postage amount exceeds the maximum allowed ceiling");
  });

  it("validates actor ownership for receipt intents", () => {
    expect(() =>
      validateIntent({ type: "receipt", recipientAddress: "G_OTHER" }, "G_ACTOR", mockConfig),
    ).toThrow("Actor mismatch");
  });
});
