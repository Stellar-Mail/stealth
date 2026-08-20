import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateRegistryDrift } from "../../../src/config/registry";
import { BetaRuntimeConfig } from "../../../src/config/schema";

// Mock the node:fs module
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

import { existsSync, readFileSync } from "node:fs";

describe("Runtime Registry Drift Validation", () => {
  const mockConfigBase: any = {
    profile: "production",
    network: {
      stellarNetwork: "testnet",
    },
    contract: {
      postageContractId: "CBBBB1",
      registryContractId: "CAAAA1",
      lifecycleContractId: "CAAAA1",
    },
  };

  const mockManifest = {
    network: "testnet",
    contracts: {
      postage: { contractId: "CBBBB1" },
      lifecycle: { contractId: "CAAAA1" },
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("passes when manifest matches config", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockManifest));

    expect(() => validateRegistryDrift(mockConfigBase)).not.toThrow();
  });

  it("fails when manifest is missing in production", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(() => validateRegistryDrift(mockConfigBase)).toThrowError(
      /contract-manifest.json is missing/,
    );
  });

  it("allows missing manifest in development", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const devConfig = { ...mockConfigBase, profile: "development" };
    expect(() => validateRegistryDrift(devConfig)).not.toThrow();
  });

  it("fails on network mismatch", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ ...mockManifest, network: "mainnet" }),
    );

    expect(() => validateRegistryDrift(mockConfigBase)).toThrowError(
      /does not match manifest network/,
    );
  });

  it("fails on postage contract ID mismatch", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        ...mockManifest,
        contracts: {
          ...mockManifest.contracts,
          postage: { contractId: "CBBBB2" },
        },
      }),
    );

    expect(() => validateRegistryDrift(mockConfigBase)).toThrowError(/STEALTH_POSTAGE_CONTRACT_ID/);
  });

  it("fails on registry (lifecycle) contract ID mismatch", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        ...mockManifest,
        contracts: {
          ...mockManifest.contracts,
          lifecycle: { contractId: "CAAAA2" },
        },
      }),
    );

    expect(() => validateRegistryDrift(mockConfigBase)).toThrowError(
      /STEALTH_REGISTRY_CONTRACT_ID/,
    );
  });
});
