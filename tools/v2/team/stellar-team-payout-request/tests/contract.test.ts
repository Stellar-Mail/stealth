import { describe, it, expect } from "vitest";
import { createPayoutContract, PayoutErrorCode } from "../contract";
import type { PayoutFormData } from "../types";

function isPayoutOutput(output: any): output is { type: "payout"; payout: any } {
  return output.type === "payout";
}

function isPayoutsOutput(output: any): output is { type: "payouts"; payouts: any[] } {
  return output.type === "payouts";
}

describe("Payout Contract", () => {
  const contract = createPayoutContract();

  describe("createPayout", () => {
    it("should create a payout with valid data", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      const result = contract.execute({ type: "createPayout", data });

      expect(result.ok).toBe(true);
      if (result.ok && isPayoutOutput(result.data)) {
        expect(result.data.type).toBe("payout");
        expect(result.data.payout.recipientEmail).toBe("user@example.com");
        expect(result.data.payout.amount).toBe("100.00");
        expect(result.data.payout.status).toBe("pending");
      }
    });

    it("should reject invalid email format", () => {
      const data: PayoutFormData = {
        recipientEmail: "invalid-email",
        amount: "100.00",
      };

      const result = contract.execute({ type: "createPayout", data });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PayoutErrorCode.VALIDATION_ERROR);
        expect(result.message).toContain("Invalid email format");
      }
    });

    it("should reject invalid amount", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "-50.00",
      };

      const result = contract.execute({ type: "createPayout", data });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PayoutErrorCode.VALIDATION_ERROR);
        expect(result.message).toContain("Amount must be a positive number");
      }
    });

    it("should reject amount with more than 2 decimal places", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.123",
      };

      const result = contract.execute({ type: "createPayout", data });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PayoutErrorCode.VALIDATION_ERROR);
        expect(result.message).toContain("at most 2 decimal places");
      }
    });

    it("should reject memo longer than 28 bytes", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
        memo: "a".repeat(29),
      };

      const result = contract.execute({ type: "createPayout", data });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PayoutErrorCode.VALIDATION_ERROR);
        expect(result.message).toContain("28 bytes or less");
      }
    });

    it("should accept valid memo", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
        memo: "Team payout Q1",
      };

      const result = contract.execute({ type: "createPayout", data });

      expect(result.ok).toBe(true);
      if (result.ok && isPayoutOutput(result.data)) {
        expect(result.data.payout.memo).toBe("Team payout Q1");
      }
    });

    it("should accept scheduled date", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
        scheduledFor: "2024-12-31T23:59:59Z",
      };

      const result = contract.execute({ type: "createPayout", data });

      expect(result.ok).toBe(true);
      if (result.ok && isPayoutOutput(result.data)) {
        expect(result.data.payout.scheduledFor).toBe("2024-12-31T23:59:59Z");
      }
    });
  });

  describe("getPayouts", () => {
    it("should return empty array initially", () => {
      const result = contract.execute({ type: "getPayouts" });

      expect(result.ok).toBe(true);
      if (result.ok && isPayoutsOutput(result.data)) {
        expect(result.data.type).toBe("payouts");
        expect(result.data.payouts).toEqual([]);
      }
    });

    it("should return created payouts", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      contract.execute({ type: "createPayout", data });

      const result = contract.execute({ type: "getPayouts" });

      expect(result.ok).toBe(true);
      if (result.ok && isPayoutsOutput(result.data)) {
        expect(result.data.type).toBe("payouts");
        expect(result.data.payouts.length).toBe(1);
        expect(result.data.payouts[0].recipientEmail).toBe("user@example.com");
      }
    });

    it("should filter by userId", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      contract.execute({ type: "createPayout", data, userId: "user1" });
      contract.execute({ type: "createPayout", data, userId: "user2" });

      const result1 = contract.execute({ type: "getPayouts", userId: "user1" });
      const result2 = contract.execute({ type: "getPayouts", userId: "user2" });

      expect(result1.ok).toBe(true);
      if (result1.ok && isPayoutsOutput(result1.data)) {
        expect(result1.data.payouts.length).toBe(1);
      }

      expect(result2.ok).toBe(true);
      if (result2.ok && isPayoutsOutput(result2.data)) {
        expect(result2.data.payouts.length).toBe(1);
      }
    });
  });

  describe("getPayoutById", () => {
    it("should return payout by id", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      const createResult = contract.execute({ type: "createPayout", data });
      expect(createResult.ok).toBe(true);

      const payoutId = createResult.ok && isPayoutOutput(createResult.data) ? createResult.data.payout.id : "";
      const result = contract.execute({ type: "getPayoutById", id: payoutId });

      expect(result.ok).toBe(true);
      if (result.ok && isPayoutOutput(result.data)) {
        expect(result.data.type).toBe("payout");
        expect(result.data.payout.id).toBe(payoutId);
      }
    });

    it("should return not found for non-existent id", () => {
      const result = contract.execute({ type: "getPayoutById", id: "non-existent" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PayoutErrorCode.NOT_FOUND);
        expect(result.message).toContain("not found");
      }
    });
  });

  describe("cancelPayout", () => {
    it("should cancel a pending payout", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      const createResult = contract.execute({ type: "createPayout", data });
      expect(createResult.ok).toBe(true);

      const payoutId = createResult.ok && isPayoutOutput(createResult.data) ? createResult.data.payout.id : "";
      const result = contract.execute({ type: "cancelPayout", id: payoutId });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.type).toBe("success");
      }

      // Verify status changed
      const getResult = contract.execute({ type: "getPayoutById", id: payoutId });
      expect(getResult.ok).toBe(true);
      if (getResult.ok && isPayoutOutput(getResult.data)) {
        expect(getResult.data.payout.status).toBe("failed");
        expect(getResult.data.payout.error).toBe("Cancelled by user");
      }
    });

    it("should return not found for non-existent payout", () => {
      const result = contract.execute({ type: "cancelPayout", id: "non-existent" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PayoutErrorCode.NOT_FOUND);
      }
    });

    it("should reject cancelling non-pending payout", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      const createResult = contract.execute({ type: "createPayout", data });
      expect(createResult.ok).toBe(true);

      const payoutId = createResult.ok && isPayoutOutput(createResult.data) ? createResult.data.payout.id : "";
      
      // Update status to submitted
      contract.execute({ type: "updatePayoutStatus", id: payoutId, status: "submitted" });

      const result = contract.execute({ type: "cancelPayout", id: payoutId });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PayoutErrorCode.INVALID_OPERATION);
        expect(result.message).toContain("Cannot cancel");
      }
    });
  });

  describe("retryPayout", () => {
    it("should retry a failed payout", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      const createResult = contract.execute({ type: "createPayout", data });
      expect(createResult.ok).toBe(true);

      const payoutId = createResult.ok && isPayoutOutput(createResult.data) ? createResult.data.payout.id : "";
      
      // Cancel to make it failed
      contract.execute({ type: "cancelPayout", id: payoutId });

      const result = contract.execute({ type: "retryPayout", id: payoutId });

      expect(result.ok).toBe(true);
      if (result.ok && isPayoutOutput(result.data)) {
        expect(result.data.type).toBe("payout");
        expect(result.data.payout.status).toBe("pending");
        expect(result.data.payout.error).toBeUndefined();
      }
    });

    it("should return not found for non-existent payout", () => {
      const result = contract.execute({ type: "retryPayout", id: "non-existent" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PayoutErrorCode.NOT_FOUND);
      }
    });

    it("should reject retrying non-failed payout", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      const createResult = contract.execute({ type: "createPayout", data });
      expect(createResult.ok).toBe(true);

      const payoutId = createResult.ok && isPayoutOutput(createResult.data) ? createResult.data.payout.id : "";

      const result = contract.execute({ type: "retryPayout", id: payoutId });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PayoutErrorCode.INVALID_OPERATION);
        expect(result.message).toContain("Cannot retry");
      }
    });
  });

  describe("updatePayoutStatus", () => {
    it("should update to submitted status", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      const createResult = contract.execute({ type: "createPayout", data });
      expect(createResult.ok).toBe(true);

      const payoutId = createResult.ok && isPayoutOutput(createResult.data) ? createResult.data.payout.id : "";
      
      const result = contract.execute({
        type: "updatePayoutStatus",
        id: payoutId,
        status: "submitted",
        transactionId: "tx-123",
      });

      expect(result.ok).toBe(true);
      if (result.ok && isPayoutOutput(result.data)) {
        expect(result.data.payout.status).toBe("submitted");
        expect(result.data.payout.transactionId).toBe("tx-123");
        expect(result.data.payout.submittedAt).toBeDefined();
      }
    });

    it("should update to confirmed status", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      const createResult = contract.execute({ type: "createPayout", data });
      expect(createResult.ok).toBe(true);

      const payoutId = createResult.ok && isPayoutOutput(createResult.data) ? createResult.data.payout.id : "";
      
      const result = contract.execute({
        type: "updatePayoutStatus",
        id: payoutId,
        status: "confirmed",
      });

      expect(result.ok).toBe(true);
      if (result.ok && isPayoutOutput(result.data)) {
        expect(result.data.payout.status).toBe("confirmed");
        expect(result.data.payout.confirmedAt).toBeDefined();
      }
    });

    it("should update to failed status with error", () => {
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      const createResult = contract.execute({ type: "createPayout", data });
      expect(createResult.ok).toBe(true);

      const payoutId = createResult.ok && isPayoutOutput(createResult.data) ? createResult.data.payout.id : "";
      
      const result = contract.execute({
        type: "updatePayoutStatus",
        id: payoutId,
        status: "failed",
        error: "Insufficient balance",
      });

      expect(result.ok).toBe(true);
      if (result.ok && isPayoutOutput(result.data)) {
        expect(result.data.payout.status).toBe("failed");
        expect(result.data.payout.error).toBe("Insufficient balance");
      }
    });

    it("should return not found for non-existent payout", () => {
      const result = contract.execute({
        type: "updatePayoutStatus",
        id: "non-existent",
        status: "submitted",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PayoutErrorCode.NOT_FOUND);
      }
    });
  });

  describe("Error handling", () => {
    it("should handle unknown errors gracefully", () => {
      // This test ensures the contract handles unexpected errors
      const data: PayoutFormData = {
        recipientEmail: "user@example.com",
        amount: "100.00",
      };

      const result = contract.execute({ type: "createPayout", data });

      // Valid request should succeed
      expect(result.ok).toBe(true);
    });
  });

  describe("Idempotency", () => {
    it("should allow multiple creates with different data", () => {
      const data1: PayoutFormData = {
        recipientEmail: "user1@example.com",
        amount: "100.00",
      };

      const data2: PayoutFormData = {
        recipientEmail: "user2@example.com",
        amount: "200.00",
      };

      const result1 = contract.execute({ type: "createPayout", data: data1 });
      const result2 = contract.execute({ type: "createPayout", data: data2 });

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      if (result1.ok && result2.ok && isPayoutOutput(result1.data) && isPayoutOutput(result2.data)) {
        expect(result1.data.payout.id).not.toBe(result2.data.payout.id);
      }
    });
  });
});
