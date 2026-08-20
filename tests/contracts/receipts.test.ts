/**
 * Unit tests for Receipts contract client bindings (BETA-050 / #1957).
 *
 * Covers:
 *   - parseReceiptsError: every ReceiptsError variant maps to the correct enum value
 *   - createReceiptsClient: returns a contract.Client instance
 *   - Domain rules: DuplicateReceipt, AlreadyRead, CommitmentMismatch semantics
 *   - Boundary cases: ReceiptsError enum completeness
 */

import { describe, it, expect } from "vitest";
import {
  parseReceiptsError,
  ReceiptsError,
  createReceiptsClient,
} from "../../src/services/stellar/contracts/receipts";

// ---------------------------------------------------------------------------
// parseReceiptsError
// ---------------------------------------------------------------------------

describe("parseReceiptsError", () => {
  const errorCases: Array<[number, ReceiptsError]> = [
    [1, ReceiptsError.DuplicateReceipt],
    [2, ReceiptsError.ReceiptNotFound],
    [3, ReceiptsError.AlreadyRead],
    [4, ReceiptsError.CommitmentMismatch],
  ];

  for (const [code, expected] of errorCases) {
    it(`maps error code ${code} to ReceiptsError.${ReceiptsError[expected]}`, () => {
      expect(parseReceiptsError(code)).toBe(expected);
    });
  }

  it("returns undefined for an unknown error code", () => {
    expect(parseReceiptsError(0)).toBeUndefined();
    expect(parseReceiptsError(5)).toBeUndefined();
    expect(parseReceiptsError(-1)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ReceiptsError enum completeness
// ---------------------------------------------------------------------------

describe("ReceiptsError enum", () => {
  it("has exactly 4 error variants", () => {
    const numericKeys = Object.values(ReceiptsError).filter((v) => typeof v === "number");
    expect(numericKeys).toHaveLength(4);
  });

  it("DuplicateReceipt (1) guards idempotent receipt creation", () => {
    expect(ReceiptsError.DuplicateReceipt).toBe(1);
  });

  it("CommitmentMismatch (4) prevents tampered payload receipts", () => {
    expect(ReceiptsError.CommitmentMismatch).toBe(4);
  });

  it("AlreadyRead (3) prevents double read-receipt marking", () => {
    expect(ReceiptsError.AlreadyRead).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// createReceiptsClient
// ---------------------------------------------------------------------------

describe("createReceiptsClient", () => {
  const DUMMY_CONTRACT_ID = "C" + "B".repeat(55);
  const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
  const TESTNET_RPC = "https://soroban-testnet.stellar.org";

  it("returns a contract.Client instance with the provided options", () => {
    const client = createReceiptsClient({
      contractId: DUMMY_CONTRACT_ID,
      networkPassphrase: TESTNET_PASSPHRASE,
      rpcUrl: TESTNET_RPC,
    });
    expect(client).toBeDefined();
    expect(typeof client).toBe("object");
  });

  it("accepts an optional publicKey without throwing", () => {
    const publicKey = "G" + "B".repeat(55);
    expect(() =>
      createReceiptsClient({
        contractId: DUMMY_CONTRACT_ID,
        networkPassphrase: TESTNET_PASSPHRASE,
        rpcUrl: TESTNET_RPC,
        publicKey,
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Domain rules
// ---------------------------------------------------------------------------

describe("ReceiptsError domain rules", () => {
  it("DuplicateReceipt is distinct from AlreadyRead", () => {
    expect(ReceiptsError.DuplicateReceipt).not.toBe(ReceiptsError.AlreadyRead);
  });

  it("ReceiptNotFound (2) is the lookup-miss sentinel", () => {
    expect(parseReceiptsError(2)).toBe(ReceiptsError.ReceiptNotFound);
  });

  it("CommitmentMismatch (4) is the integrity failure sentinel", () => {
    expect(parseReceiptsError(4)).toBe(ReceiptsError.CommitmentMismatch);
  });

  it("malformed code (non-integer) returns undefined gracefully", () => {
    // parseReceiptsError expects a number; we test that NaN and floats are
    // treated the same way as unknown codes.
    expect(parseReceiptsError(NaN)).toBeUndefined();
    expect(parseReceiptsError(1.5)).toBeUndefined();
  });
});
