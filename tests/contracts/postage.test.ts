/**
 * Unit tests for Postage contract client bindings (BETA-050 / #1957).
 *
 * Covers:
 *   - parsePostageError: every PostageError variant maps to the correct enum value
 *   - createPostageClient: returns a contract.Client instance
 *   - Domain rules: duplicate detection enum present, all status variants present
 *   - Boundary cases: PostageStatus enum completeness, PostageError enum completeness
 */

import { describe, it, expect } from "vitest";
import {
  parsePostageError,
  PostageError,
  PostageStatus,
  createPostageClient,
} from "../../src/services/stellar/contracts/postage";

// ---------------------------------------------------------------------------
// parsePostageError
// ---------------------------------------------------------------------------

describe("parsePostageError", () => {
  const errorCases: Array<[number, PostageError]> = [
    [1, PostageError.AlreadyInitialized],
    [2, PostageError.NotInitialized],
    [3, PostageError.InvalidAmount],
    [4, PostageError.DuplicateMessage],
    [5, PostageError.PostageNotFound],
    [6, PostageError.AlreadyResolved],
    [7, PostageError.InvalidFee],
    [8, PostageError.InvalidWindow],
    [9, PostageError.NotExpired],
    [10, PostageError.DisputeUnavailable],
    [11, PostageError.GuardNotConfigured],
    [12, PostageError.LifecycleRejected],
  ];

  for (const [code, expected] of errorCases) {
    it(`maps error code ${code} to PostageError.${PostageError[expected]}`, () => {
      expect(parsePostageError(code)).toBe(expected);
    });
  }

  it("returns undefined for an unknown error code", () => {
    expect(parsePostageError(0)).toBeUndefined();
    expect(parsePostageError(99)).toBeUndefined();
    expect(parsePostageError(-1)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PostageStatus enum completeness
// ---------------------------------------------------------------------------

describe("PostageStatus enum", () => {
  it("contains all six lifecycle statuses with correct numeric values", () => {
    expect(PostageStatus.Pending).toBe(0);
    expect(PostageStatus.Expired).toBe(1);
    expect(PostageStatus.Disputed).toBe(2);
    expect(PostageStatus.Settled).toBe(3);
    expect(PostageStatus.Refunded).toBe(4);
    expect(PostageStatus.Reclaimed).toBe(5);
  });

  it("has exactly 6 status variants (no undocumented additions)", () => {
    // TypeScript numeric enums include both forward and reverse mappings.
    const numericKeys = Object.values(PostageStatus).filter((v) => typeof v === "number");
    expect(numericKeys).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// PostageError enum completeness
// ---------------------------------------------------------------------------

describe("PostageError enum", () => {
  it("has exactly 12 error variants", () => {
    const numericKeys = Object.values(PostageError).filter((v) => typeof v === "number");
    expect(numericKeys).toHaveLength(12);
  });

  it("includes the DuplicateMessage variant for idempotency enforcement", () => {
    expect(PostageError.DuplicateMessage).toBe(4);
  });

  it("includes LifecycleRejected for cross-contract guard enforcement", () => {
    expect(PostageError.LifecycleRejected).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// createPostageClient
// ---------------------------------------------------------------------------

describe("createPostageClient", () => {
  const DUMMY_CONTRACT_ID = "C" + "A".repeat(55);
  const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
  const TESTNET_RPC = "https://soroban-testnet.stellar.org";

  it("returns a contract.Client instance with the provided options", () => {
    const client = createPostageClient({
      contractId: DUMMY_CONTRACT_ID,
      networkPassphrase: TESTNET_PASSPHRASE,
      rpcUrl: TESTNET_RPC,
    });
    expect(client).toBeDefined();
    // The stellar-sdk contract.Client exposes an `options` property
    expect(typeof client).toBe("object");
  });

  it("accepts an optional publicKey without throwing", () => {
    const publicKey = "G" + "A".repeat(55);
    expect(() =>
      createPostageClient({
        contractId: DUMMY_CONTRACT_ID,
        networkPassphrase: TESTNET_PASSPHRASE,
        rpcUrl: TESTNET_RPC,
        publicKey,
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Domain rule: DuplicateMessage is the idempotency guard
// ---------------------------------------------------------------------------

describe("PostageError domain rules", () => {
  it("DuplicateMessage (4) is distinct from AlreadyResolved (6)", () => {
    expect(PostageError.DuplicateMessage).not.toBe(PostageError.AlreadyResolved);
  });

  it("minimum amount boundary: InvalidAmount is code 3", () => {
    expect(parsePostageError(3)).toBe(PostageError.InvalidAmount);
  });

  it("dispute window boundary: InvalidWindow is code 8", () => {
    expect(parsePostageError(8)).toBe(PostageError.InvalidWindow);
  });

  it("expiry boundary: NotExpired is code 9", () => {
    expect(parsePostageError(9)).toBe(PostageError.NotExpired);
  });
});
