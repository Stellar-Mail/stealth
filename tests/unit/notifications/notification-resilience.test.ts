import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  NotificationCircuitBreaker,
  ResilientNotificationDeliveryService,
  DeadLetterQueue,
} from "../../../src/services/notifications/resilience";
import type {
  NotificationAdapter,
  VerificationEmailMessage,
  DeliveryReceipt,
} from "../../../src/services/notifications/adapter";

describe("BETA-005: Notification Resilience & Circuit Breaker", () => {
  describe("NotificationCircuitBreaker", () => {
    let cb: NotificationCircuitBreaker;

    beforeEach(() => {
      cb = new NotificationCircuitBreaker("smtp", {
        failureThreshold: 3,
        resetTimeoutMs: 100,
        halfOpenMaxTrials: 1,
      });
    });

    it("starts in closed state", () => {
      expect(cb.currentState).toBe("closed");
      expect(cb.isOpen()).toBe(false);
    });

    it("transitions to open state after reaching failure threshold", () => {
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.currentState).toBe("closed");

      cb.recordFailure();
      expect(cb.currentState).toBe("open");
      expect(cb.isOpen()).toBe(true);
    });

    it("transitions to half-open after reset timeout", async () => {
      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.currentState).toBe("open");

      await new Promise((r) => setTimeout(r, 110));
      expect(cb.currentState).toBe("half-open");
    });

    it("resets back to closed on success", () => {
      cb.recordFailure();
      cb.recordFailure();
      cb.recordSuccess();
      expect(cb.currentState).toBe("closed");
    });
  });

  describe("DeadLetterQueue", () => {
    it("enqueues and retrieves quarantined entries", () => {
      const dlq = new DeadLetterQueue(10);
      dlq.enqueue({
        id: "entry-1",
        messageSummary: {
          to: "user@example.com",
          purpose: "email_verification",
          safeTargetReference: "ref-1",
        },
        failedAttempts: 3,
        lastError: "SMTP connection refused",
        firstFailedAt: new Date().toISOString(),
        lastFailedAt: new Date().toISOString(),
        transport: "smtp",
      });

      expect(dlq.size).toBe(1);
      const retrieved = dlq.get("entry-1");
      expect(retrieved?.lastError).toBe("SMTP connection refused");
      expect(dlq.remove("entry-1")).toBe(true);
      expect(dlq.size).toBe(0);
    });
  });

  describe("ResilientNotificationDeliveryService", () => {
    it("successfully delivers on first attempt when inner adapter succeeds", async () => {
      const mockAdapter: NotificationAdapter = {
        transport: "smtp",
        deliverVerificationEmail: vi.fn().mockResolvedValue({
          transport: "smtp",
          accepted: true,
          providerRef: "smtp-mock-123",
          safeTargetReference: "target-ref-1",
        }),
      };

      const resilientService = new ResilientNotificationDeliveryService(mockAdapter, {
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 50,
        backoffFactor: 2,
      });

      const message: VerificationEmailMessage = {
        to: "alice@stealth.mail",
        purpose: "email_verification",
        verificationUrl: "https://stealth.mail/verify?token=abc",
        expiresAt: new Date(Date.now() + 3600000),
      };

      const receipt = await resilientService.deliverVerificationEmail(message);
      expect(receipt.accepted).toBe(true);
      expect(receipt.providerRef).toBe("smtp-mock-123");
      expect(mockAdapter.deliverVerificationEmail).toHaveBeenCalledTimes(1);
    });

    it("retries on transient failure and recovers", async () => {
      let callCount = 0;
      const mockAdapter: NotificationAdapter = {
        transport: "smtp",
        deliverVerificationEmail: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error("Transient socket timeout"));
          }
          return Promise.resolve({
            transport: "smtp",
            accepted: true,
            providerRef: "smtp-mock-recovered",
            safeTargetReference: "target-ref-1",
          });
        }),
      };

      const resilientService = new ResilientNotificationDeliveryService(mockAdapter, {
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 50,
        backoffFactor: 1.5,
      });

      const message: VerificationEmailMessage = {
        to: "bob@stealth.mail",
        purpose: "email_verification",
        verificationUrl: "https://stealth.mail/verify?token=abc",
        expiresAt: new Date(Date.now() + 3600000),
      };

      const receipt = await resilientService.deliverVerificationEmail(message);
      expect(receipt.accepted).toBe(true);
      expect(callCount).toBe(2);
    });

    it("enqueues to DLQ and trips circuit breaker on persistent failure", async () => {
      const mockAdapter: NotificationAdapter = {
        transport: "smtp",
        deliverVerificationEmail: vi.fn().mockRejectedValue(new Error("Permanent SMTP Error 550")),
      };

      const resilientService = new ResilientNotificationDeliveryService(
        mockAdapter,
        { maxRetries: 2, initialDelayMs: 5, maxDelayMs: 20, backoffFactor: 1 },
        { failureThreshold: 1, resetTimeoutMs: 1000, halfOpenMaxTrials: 1 },
      );

      const message: VerificationEmailMessage = {
        to: "charlie@stealth.mail",
        purpose: "email_verification",
        verificationUrl: "https://stealth.mail/verify?token=abc",
        expiresAt: new Date(Date.now() + 3600000),
      };

      const receipt = await resilientService.deliverVerificationEmail(message);
      expect(receipt.accepted).toBe(false);
      expect(receipt.reasonClass).toBe("max_retries_exceeded");
      expect(resilientService.dlq.size).toBe(1);
    });
  });
});
