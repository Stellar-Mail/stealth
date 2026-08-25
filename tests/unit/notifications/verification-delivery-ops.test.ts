import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canTransitionDeliveryState,
  classifySmtpReplyCode,
} from "../../../src/services/notifications/delivery-status";
import {
  containsSensitiveNotificationMaterial,
  recipientDomain,
  redactNotificationText,
} from "../../../src/services/notifications/redaction";
import { VerificationMailQueue } from "../../../src/services/notifications/queue";
import {
  InviteFallbackNotificationAdapter,
  OrchestratedNotificationAdapter,
} from "../../../src/services/notifications/orchestrator";
import { SinkNotificationAdapter } from "../../../src/services/notifications/sink";
import { SmtpError } from "../../../src/services/notifications/smtp";
import { buildNotificationHealthReport } from "../../../src/services/notifications/health";
import type { VerificationEmailMessage } from "../../../src/services/notifications/adapter";

describe("BETA-091: delivery status machine", () => {
  it("classifies SMTP codes into retryable vs permanent states", () => {
    expect(classifySmtpReplyCode(250)).toMatchObject({
      state: "accepted",
      retryable: false,
    });
    expect(classifySmtpReplyCode(451).retryable).toBe(true);
    expect(classifySmtpReplyCode(550)).toMatchObject({
      state: "hard_bounce",
      retryable: false,
    });
  });

  it("allows sent → delivered and rejects hard_bounce → sent", () => {
    expect(canTransitionDeliveryState("sent", "delivered")).toBe(true);
    expect(canTransitionDeliveryState("hard_bounce", "sent")).toBe(false);
  });
});

describe("BETA-091: redaction", () => {
  it("scrubs tokens, verify URLs, and password material", () => {
    const redacted = redactNotificationText(
      "boom https://app.test/verify?email=a@b.c&token=tok_test_placeholder password=lab-pass",
    );
    expect(redacted).not.toContain("tok_test_placeholder");
    expect(redacted).not.toContain("lab-pass");
    expect(containsSensitiveNotificationMaterial(redacted)).toBe(false);
    expect(recipientDomain("User@Example.COM")).toBe("example.com");
  });
});

describe("BETA-091: verification mail queue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("records success with messageId idempotency and hashed recipient only", async () => {
    const queue = new VerificationMailQueue({
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });
    const messageId = "vm_success_1";
    let calls = 0;
    queue.enqueue(
      {
        messageId,
        purpose: "email_verification",
        recipientEmail: "alice@stealth.test",
      },
      async () => {
        calls += 1;
        return { accepted: true, providerRef: "smtp-1" };
      },
    );

    const first = await queue.attempt(messageId);
    const secondEnqueue = queue.enqueue(
      {
        messageId,
        purpose: "email_verification",
        recipientEmail: "alice@stealth.test",
      },
      async () => {
        calls += 1;
        return { accepted: true };
      },
    );

    expect(first.state).toBe("sent");
    expect(first.recipientDomain).toBe("stealth.test");
    expect(JSON.stringify(first)).not.toContain("alice");
    expect(secondEnqueue.messageId).toBe(messageId);
    expect(calls).toBe(1);
    expect(queue.hasRetryCallback(messageId)).toBe(false);
  });

  it("retries soft failures via processDue then dead-letters hard bounces", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T00:00:00.000Z"));
    const queue = new VerificationMailQueue({
      baseBackoffMs: 10,
      maxBackoffMs: 20,
      defaultMaxAttempts: 3,
      now: () => new Date(Date.now()),
    });

    let attempt = 0;
    queue.enqueue(
      {
        messageId: "vm_bounce_1",
        purpose: "password_reset",
        recipientEmail: "bob@stealth.test",
      },
      async () => {
        attempt += 1;
        if (attempt === 1) return { accepted: false, smtpCode: 451 };
        return { accepted: false, smtpCode: 550 };
      },
    );

    const deferred = await queue.attempt("vm_bounce_1");
    expect(deferred.state).toBe("deferred");
    expect(queue.hasRetryCallback("vm_bounce_1")).toBe(true);

    vi.advanceTimersByTime(50);
    const { processVerificationMailQueue } =
      await import("../../../src/services/notifications/worker");
    const drained = await processVerificationMailQueue({ queue, batchSize: 5 });
    expect(drained.processed).toBe(1);
    expect(drained.records[0]?.state).toBe("hard_bounce");
    expect(queue.deadLetterList().some((row) => row.messageId === "vm_bounce_1")).toBe(true);
    expect(queue.hasRetryCallback("vm_bounce_1")).toBe(false);
  });

  it("applies provider bounce events without retaining raw token text", async () => {
    const queue = new VerificationMailQueue({
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });
    queue.enqueue(
      {
        messageId: "vm_evt_1",
        purpose: "email_verification",
        recipientEmail: "carol@stealth.test",
      },
      async () => ({ accepted: true }),
    );
    await queue.attempt("vm_evt_1");
    expect(queue.hasRetryCallback("vm_evt_1")).toBe(false);

    const updated = queue.applyProviderEvent({
      messageId: "vm_evt_1",
      eventType: "hard_bounce",
      rawReason: "550 no such user token=tok_bounce_fixture",
    });

    expect(updated?.state).toBe("hard_bounce");
    expect(JSON.stringify(updated)).not.toContain("tok_bounce_fixture");
    expect(queue.hasRetryCallback("vm_evt_1")).toBe(false);
  });
});

describe("BETA-091: orchestrator + invite fallback", () => {
  const message: VerificationEmailMessage = {
    to: "dana@stealth.test",
    purpose: "email_verification",
    verificationUrl: "https://app.test/verify?email=dana%40stealth.test&token=tok_123",
    expiresAt: new Date("2026-08-25T00:00:00.000Z"),
  };

  it("wraps a successful sink send with delivery state metadata", async () => {
    const queue = new VerificationMailQueue({
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });
    const adapter = new OrchestratedNotificationAdapter(new SinkNotificationAdapter(), queue);
    const receipt = await adapter.deliverVerificationEmail(message);
    expect(receipt.accepted).toBe(true);
    expect(receipt.deliveryState).toBe("sent");
    expect(receipt.messageId).toMatch(/^vm_/);
    expect(receipt.safeTargetReference).not.toContain("dana");
  });

  it("falls back to capture sink outside production when SMTP fails", async () => {
    const failing: {
      transport: "smtp";
      deliverVerificationEmail: () => Promise<never>;
    } = {
      transport: "smtp",
      deliverVerificationEmail: async () => {
        throw new SmtpError("smtp unavailable", { replyCode: 421, command: "CONNECT" });
      },
    };
    const fallback = new InviteFallbackNotificationAdapter(failing, "development");
    const receipt = await fallback.deliverVerificationEmail(message);
    expect(receipt.accepted).toBe(true);
    expect(fallback.didFallBack()).toBe(true);
    expect(fallback.getCaptureSink().latestMessage?.to).toBe(message.to);
  });

  it("never falls back in production", async () => {
    const failing = {
      transport: "smtp" as const,
      deliverVerificationEmail: async () => {
        throw new SmtpError("smtp unavailable", { replyCode: 421 });
      },
    };
    const fallback = new InviteFallbackNotificationAdapter(failing, "production");
    await expect(fallback.deliverVerificationEmail(message)).rejects.toBeInstanceOf(SmtpError);
  });
});

describe("BETA-091: notification health", () => {
  it("skips transport probe for sink and reports queue rate", async () => {
    const report = await buildNotificationHealthReport({
      config: {
        transport: "sink",
        fromAddress: "noreply@localhost",
        verification: {
          tokenLifetimeMs: 1,
          resendCooldownMs: 1,
          maxAttempts: 1,
        },
        smtp: {
          host: "localhost",
          port: 1025,
          secure: false,
          startTls: false,
        },
      },
      queueLagMs: 0,
      recentSendRate: { windowSeconds: 60, count: 2 },
      deadLetterCount: 0,
    });
    expect(report.transport).toBe("skipped");
    expect(report.detail).toBe("sink_capture_active");
  });

  it("marks degraded when the MTA is up but DLQ has entries", async () => {
    const report = await buildNotificationHealthReport({
      config: {
        transport: "smtp",
        fromAddress: "noreply@example.test",
        verification: {
          tokenLifetimeMs: 1,
          resendCooldownMs: 1,
          maxAttempts: 1,
        },
        smtp: {
          host: "smtp.example.test",
          port: 587,
          secure: false,
          startTls: true,
        },
      },
      queueLagMs: 0,
      recentSendRate: { windowSeconds: 60, count: 0 },
      deadLetterCount: 3,
      probe: async () => ({ status: "ok", detail: "banner_ok" }),
    });
    expect(report.transport).toBe("degraded");
  });
});
