import { describe, expect, it } from "vitest";

import type { VerificationEmailMessage } from "../../../src/services/notifications/adapter";
import { SinkNotificationAdapter } from "../../../src/services/notifications/sink";

function sampleMessage(
  overrides: Partial<VerificationEmailMessage> = {},
): VerificationEmailMessage {
  return {
    to: "alice@stealth.mail",
    purpose: "email_verification",
    verificationUrl: "https://stealth.mail/verify?email=alice%40stealth.mail&token=abc",
    expiresAt: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("BETA-005: SinkNotificationAdapter (development capture sink)", () => {
  it("accepts every message and records a receipt", async () => {
    const sink = new SinkNotificationAdapter();
    const receipt = await sink.deliverVerificationEmail(sampleMessage());

    expect(receipt).toMatchObject({ transport: "sink", accepted: true });
    expect(receipt.safeTargetReference).toMatch(/^[a-f0-9]{64}$/);
  });

  it("buffers captured messages in delivery order", async () => {
    const sink = new SinkNotificationAdapter();
    await sink.deliverVerificationEmail(sampleMessage({ to: "first@stealth.mail" }));
    await sink.deliverVerificationEmail(sampleMessage({ to: "second@stealth.mail" }));

    expect(sink.size).toBe(2);
    expect(sink.capturedMessages.map((message) => message.to)).toEqual([
      "first@stealth.mail",
      "second@stealth.mail",
    ]);
    expect(sink.latestMessage?.to).toBe("second@stealth.mail");
  });

  it("preserves expiry as a Date in captured messages", async () => {
    const sink = new SinkNotificationAdapter();
    const expiresAt = new Date("2026-03-01T00:00:00.000Z");
    await sink.deliverVerificationEmail(sampleMessage({ expiresAt }));

    expect(sink.latestMessage?.expiresAt).toBeInstanceOf(Date);
    expect(sink.latestMessage?.expiresAt).toEqual(expiresAt);
  });

  it("is bounded by the configured buffer size", async () => {
    const sink = new SinkNotificationAdapter(2);
    await sink.deliverVerificationEmail(sampleMessage({ to: "a@stealth.mail" }));
    await sink.deliverVerificationEmail(sampleMessage({ to: "b@stealth.mail" }));
    await sink.deliverVerificationEmail(sampleMessage({ to: "c@stealth.mail" }));

    expect(sink.size).toBe(2);
    expect(sink.capturedMessages.map((message) => message.to)).toEqual([
      "b@stealth.mail",
      "c@stealth.mail",
    ]);
  });

  it("isolates returned messages from caller mutation", async () => {
    const sink = new SinkNotificationAdapter();
    await sink.deliverVerificationEmail(sampleMessage());

    const captured = sink.latestMessage!;
    captured.to = "mutated@stealth.mail";
    expect(sink.latestMessage?.to).toBe("alice@stealth.mail");
  });

  it("clears the buffer on request", async () => {
    const sink = new SinkNotificationAdapter();
    await sink.deliverVerificationEmail(sampleMessage());
    expect(sink.size).toBe(1);

    sink.clear();
    expect(sink.size).toBe(0);
    expect(sink.latestMessage).toBeNull();
  });
});
