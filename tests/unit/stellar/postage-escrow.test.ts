import { describe, expect, it } from "vitest";
import {
  PostageEscrowAdapter,
  classifyRetry,
  chainStatusToDomain,
  redactError,
  type PostageOperation,
  type RetryClassification,
} from "../../../src/services/stellar/postage-escrow";
import { PostageError } from "../../../src/services/stellar/contracts/postage";
import type { BetaRuntimeConfig } from "../../../src/config/schema";

const REAL_CONTRACT = "CCJOU3X4NTZ2ND43FOS5XOK735G6F7ZZW357ZZZZZZZZZZZZZZZZZZZZ";
const DEV_PLACEHOLDER = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const REGISTRY_PLACEHOLDER = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function makeConfig(
  overrides: {
    network?: Partial<BetaRuntimeConfig["network"]>;
    contract?: Partial<BetaRuntimeConfig["contract"]>;
  } = {},
): BetaRuntimeConfig {
  return {
    network: {
      stellarNetwork: "testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
      horizonUrl: "https://horizon-testnet.stellar.org",
      sorobanRpcUrl: "https://soroban-testnet.stellar.org",
      ...overrides.network,
    },
    contract: {
      postageContractId: REAL_CONTRACT,
      ...overrides.contract,
    },
    secrets: {},
    ...overrides,
  } as unknown as BetaRuntimeConfig;
}

function contractError(code: number): Error {
  return new Error(`Contract, Error(Contract, #${code})`);
}

describe("classifyRetry", () => {
  const operations: PostageOperation[] = [
    "submit",
    "settle",
    "refund",
    "dispute",
    "expire",
    "reclaim",
  ];

  it("classifies submit DuplicateMessage as safe (idempotent duplicate)", () => {
    expect(classifyRetry("submit", contractError(PostageError.DuplicateMessage))).toBe("safe");
  });

  it("classifies submit AlreadyInitialized as never", () => {
    expect(classifyRetry("submit", contractError(PostageError.AlreadyInitialized))).toBe("never");
  });

  it("classifies resolve AlreadyResolved as safe for every terminal operation", () => {
    for (const op of ["settle", "refund", "dispute", "expire", "reclaim"] as const) {
      expect(classifyRetry(op, contractError(PostageError.AlreadyResolved))).toBe("safe");
    }
  });

  it("classifies PostageNotFound as never for non-submit operations", () => {
    for (const op of ["settle", "refund", "dispute", "expire", "reclaim"] as const) {
      expect(classifyRetry(op, contractError(PostageError.PostageNotFound))).toBe("never");
    }
  });

  it("classifies structural failures as never for every operation", () => {
    const structural: PostageError[] = [
      PostageError.InvalidAmount,
      PostageError.InvalidFee,
      PostageError.InvalidWindow,
      PostageError.GuardNotConfigured,
      PostageError.LifecycleRejected,
      PostageError.NotExpired,
      PostageError.DisputeUnavailable,
    ];
    for (const op of operations) {
      for (const code of structural) {
        expect(classifyRetry(op, contractError(code))).toBe("never");
      }
    }
  });

  it("classifies network/timeout failures as safe regardless of operation", () => {
    for (const op of operations) {
      expect(classifyRetry(op, new Error("ETIMEDOUT"))).toBe("safe");
      expect(classifyRetry(op, new Error("socket hang up 502"))).toBe("safe");
    }
  });

  it("classifies unknown errors as unknown", () => {
    expect(classifyRetry("submit", new Error("boom"))).toBe("unknown");
    expect(classifyRetry("settle", "plain string error")).toBe("unknown");
  });
});

describe("chainStatusToDomain", () => {
  it("maps on-chain status enum to domain statuses", () => {
    expect(chainStatusToDomain(0)).toBe("pending");
    expect(chainStatusToDomain(1)).toBe("expired");
    expect(chainStatusToDomain(2)).toBe("disputed");
    expect(chainStatusToDomain(3)).toBe("settled");
    expect(chainStatusToDomain(4)).toBe("refunded");
    expect(chainStatusToDomain(5)).toBe("reclaimed");
  });

  it("falls back to pending for unknown enum values", () => {
    expect(chainStatusToDomain(99 as never)).toBe("pending");
  });
});

describe("redactError", () => {
  it("redacts Stellar secret keys", () => {
    const secret = "S" + "A".repeat(55);
    const out = redactError(new Error(`failed for key ${secret}`));
    expect(out).not.toContain(secret);
    expect(out).toContain("<REDACTED_SECRET>");
  });

  it("redacts long XDR blobs", () => {
    const blob = "A".repeat(250);
    const out = redactError(`xdr=${blob}`);
    expect(out).not.toContain(blob);
    expect(out).toContain("<REDACTED_XDR>");
  });

  it("bounds output length", () => {
    const out = redactError(new Error("e".repeat(2000)), 100);
    expect(out.length).toBeLessThanOrEqual(100);
  });
});

describe("PostageEscrowAdapter", () => {
  it("isLive() rejects dev/test placeholder contract ids", () => {
    for (const contractId of [DEV_PLACEHOLDER, REGISTRY_PLACEHOLDER, "C_TEST_foo", "C_DEV_bar"]) {
      const adapter = new PostageEscrowAdapter({
        config: makeConfig({ contract: { postageContractId: contractId } }),
      });
      expect(adapter.isLive()).toBe(false);
    }
  });

  it("isLive() rejects local network", () => {
    const adapter = new PostageEscrowAdapter({
      config: makeConfig({
        network: { ...makeConfig().network, stellarNetwork: "local" },
      }),
    });
    expect(adapter.isLive()).toBe(false);
  });

  it("isLive() requires a managed wallet and non-empty rpc url", () => {
    const adapter = new PostageEscrowAdapter({
      config: makeConfig({ network: { ...makeConfig().network, sorobanRpcUrl: "" } }),
    });
    expect(adapter.isLive()).toBe(false);
  });

  it("isLive() is true for a real testnet wiring", () => {
    const adapter = new PostageEscrowAdapter({
      config: makeConfig(),
      managedWallet: {} as never,
    });
    expect(adapter.isLive()).toBe(true);
  });

  it("checkAllowanceAndBalance short-circuits when not live", async () => {
    const adapter = new PostageEscrowAdapter({
      config: makeConfig({ contract: { postageContractId: DEV_PLACEHOLDER } }),
    });
    const result = await adapter.checkAllowanceAndBalance("G" + "A".repeat(55), 1000n);
    expect(result.sufficient).toBe(true);
    expect(result.required).toBe("1000");
  });

  it("lifecycle entry points do not touch the chain when not live", async () => {
    const adapter = new PostageEscrowAdapter({
      config: makeConfig({ contract: { postageContractId: DEV_PLACEHOLDER } }),
    });
    const messageId = "a".repeat(64);
    const sender = "G" + "B".repeat(55);
    const recipient = "G" + "A".repeat(55);

    const submit = await adapter.submitEscrow(messageId, sender, recipient, 1000n);
    expect(submit.success).toBe(false);
    expect(submit.chainStatus).toBe("not_submitted");
    expect(submit.retryClassification).toBe<RetryClassification>("unknown");

    const settle = await adapter.settleEscrow(messageId, recipient);
    expect(settle.chainStatus).toBe("not_submitted");

    const refund = await adapter.refundEscrow(messageId, recipient);
    expect(refund.chainStatus).toBe("not_submitted");

    const dispute = await adapter.disputeEscrow(messageId, recipient);
    expect(dispute.chainStatus).toBe("not_submitted");

    const expire = await adapter.expireEscrow(messageId, sender);
    expect(expire.chainStatus).toBe("not_submitted");

    const reclaim = await adapter.reclaimEscrow(messageId, sender);
    expect(reclaim.chainStatus).toBe("not_submitted");
  });
});
