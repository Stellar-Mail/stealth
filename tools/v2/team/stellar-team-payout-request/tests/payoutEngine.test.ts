import { describe, it, expect } from "vitest";
import {
  validateStellarAddress,
  createPayoutRequest,
  estimateNetworkFee,
  simulatePayoutExecution,
} from "../services/payoutEngine";
import { MOCK_STELLAR_ADDRESSES } from "../fixtures/payout.fixtures";

describe("payoutEngine", () => {
  describe("validateStellarAddress", () => {
    it("returns true for a valid Stellar public key", () => {
      expect(validateStellarAddress(MOCK_STELLAR_ADDRESSES.valid)).toBe(true);
      expect(validateStellarAddress(MOCK_STELLAR_ADDRESSES.valid2)).toBe(true);
    });

    it("returns false for invalid structures", () => {
      expect(validateStellarAddress(MOCK_STELLAR_ADDRESSES.invalidFormat)).toBe(false);
      expect(validateStellarAddress("")).toBe(false);
    });
  });

  describe("estimateNetworkFee", () => {
    it("returns 0.00001 for XLM and USDC", () => {
      expect(estimateNetworkFee("XLM")).toBe(0.00001);
      expect(estimateNetworkFee("USDC")).toBe(0.00001);
    });
  });

  describe("createPayoutRequest", () => {
    it("creates a valid request for an allowed currency within quota", () => {
      const result = createPayoutRequest("tm_1", 1000, "USDC", MOCK_STELLAR_ADDRESSES.valid);
      expect(result.errors).toBeUndefined();
      expect(result.request).toBeDefined();
      expect(result.request?.status).toBe("PENDING");
      expect(result.request?.amount).toBe(1000);
      expect(result.request?.networkFeeEstimate).toBe(0.00001);
    });

    it("fails if amount exceeds quota", () => {
      const result = createPayoutRequest("tm_1", 6000, "USDC", MOCK_STELLAR_ADDRESSES.valid);
      expect(result.request).toBeUndefined();
      expect(result.errors?.amount).toBeDefined();
      expect(result.errors?.amount).toContain("exceeds allowed quota");
    });

    it("fails if amount is negative", () => {
      const result = createPayoutRequest("tm_1", -50, "XLM", MOCK_STELLAR_ADDRESSES.valid);
      expect(result.request).toBeUndefined();
      expect(result.errors?.amount).toBe("Amount must be greater than zero.");
    });

    it("fails if currency is not allowed", () => {
      const result = createPayoutRequest("tm_2", 100, "XLM", MOCK_STELLAR_ADDRESSES.valid);
      expect(result.request).toBeUndefined();
      expect(result.errors?.currency).toBeDefined();
    });

    it("fails if destination address is invalid", () => {
      const result = createPayoutRequest("tm_1", 100, "USDC", "INVALID_ADDR");
      expect(result.request).toBeUndefined();
      expect(result.errors?.destinationAddress).toBe("Invalid Stellar destination address.");
    });

    it("fails if team member does not exist", () => {
      const result = createPayoutRequest("tm_unknown", 100, "USDC", MOCK_STELLAR_ADDRESSES.valid);
      expect(result.request).toBeUndefined();
      expect(result.errors?.teamMemberId).toBe("Invalid team member ID.");
    });
  });

  describe("simulatePayoutExecution", () => {
    it("deterministically sets the status to COMPLETED", async () => {
      const { request } = createPayoutRequest("tm_1", 100, "USDC", MOCK_STELLAR_ADDRESSES.valid);
      const executed = await simulatePayoutExecution(request!);
      expect(executed.status).toBe("COMPLETED");
    });
  });
});
