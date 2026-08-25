import { describe, expect, it } from "vitest";

import {
  ingestDeliveryEvent,
  toPublicDeliveryEventRecord,
} from "../../../src/server/api/notification-delivery-events";
import { VerificationMailQueue } from "../../../src/services/notifications/queue";

describe("BETA-091: delivery-event ingestion", () => {
  it("transitions sent → hard_bounce into the DLQ with redacted reason", async () => {
    const queue = new VerificationMailQueue({
      now: () => new Date("2026-08-25T00:00:00.000Z"),
    });
    queue.enqueue(
      {
        messageId: "vm_ingest_1",
        purpose: "email_verification",
        recipientEmail: "eve@stealth.test",
      },
      async () => ({ accepted: true, providerRef: "smtp-ok" }),
    );
    await queue.attempt("vm_ingest_1");

    const result = ingestDeliveryEvent(
      {
        messageId: "vm_ingest_1",
        eventType: "hard_bounce",
        providerEventId: "dsn-lab-1",
        reason: "550 user unknown token=tok_should_not_leak",
      },
      queue,
    );

    expect(result.found).toBe(true);
    expect(result.record?.state).toBe("hard_bounce");
    expect(queue.deadLetterList().some((row) => row.messageId === "vm_ingest_1")).toBe(true);

    const publicView = toPublicDeliveryEventRecord(result.record!);
    expect(JSON.stringify(publicView)).not.toContain("tok_should_not_leak");
    expect(JSON.stringify(publicView)).not.toContain("eve@");
    expect(publicView.recipientDomain).toBe("stealth.test");
  });

  it("returns not found for unknown messageId", () => {
    const queue = new VerificationMailQueue();
    const result = ingestDeliveryEvent(
      {
        messageId: "vm_missing",
        eventType: "complaint",
      },
      queue,
    );
    expect(result.found).toBe(false);
  });
});
