import { describe, expect, it } from "vitest";
import { getEmailProvenance } from "../../../src/components/mail/provenance";
import type { Email } from "../../../src/components/mail/data";

describe("mail/provenance timeline", () => {
  const baseEmail: Email = {
    id: "123",
    from: "Alice Example",
    email: "alice@example.com",
    subject: "Test proof timeline",
    preview: "This is a preview",
    body: "Hello world",
    time: "10:00 AM",
    unread: true,
    starred: false,
    folder: "verified",
    avatarColor: "#6d28d9",
  };

  it("includes a complete timeline for verified messages", () => {
    const provenance = getEmailProvenance(baseEmail);
    expect(provenance.timeline).toHaveLength(5);
    expect(provenance.timeline.map((item) => item.status)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
    ]);
  });

  it("marks bridged messages as skipped for postage and receipt", () => {
    const bridgedEmail: Email = { ...baseEmail, folder: "spam", from: "Relay Bridge" };
    const provenance = getEmailProvenance(bridgedEmail);
    expect(provenance.timeline).toHaveLength(5);
    expect(provenance.timeline[3]).toMatchObject({ status: "skipped" });
    expect(provenance.timeline[4]).toMatchObject({ status: "skipped" });
  });
});
