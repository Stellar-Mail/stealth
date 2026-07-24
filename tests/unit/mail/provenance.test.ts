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

  it("generates a Stellar public key for an email identity", () => {
    const provenance = getEmailProvenance(baseEmail);
    expect(provenance.senderIdentity.resolved).toMatch(/^G[A-Z2-7]{55}$/);
  });

  it("uses raw identity as public key when already a G-address", () => {
    const rawKey = `G${"A".repeat(55)}`;
    const email: Email = { ...baseEmail, email: rawKey };
    const provenance = getEmailProvenance(email);
    expect(provenance.senderIdentity.resolved).toBe(rawKey);
  });

  it("assigns SMTP DNS Resolver for bridged messages", () => {
    const email: Email = { ...baseEmail, folder: "spam", from: "Bridged Relay" };
    const provenance = getEmailProvenance(email);
    expect(provenance.senderIdentity.provider).toBe("SMTP DNS Resolver");
  });

  it("assigns Federation Server for federated identities", () => {
    const email: Email = { ...baseEmail, email: "user*domain.stellar" };
    const provenance = getEmailProvenance(email);
    expect(provenance.senderIdentity.provider).toBe("Stellar Federation Server");
  });

  it("assigns Stellar Account Indexer for plain emails", () => {
    const provenance = getEmailProvenance(baseEmail);
    expect(provenance.senderIdentity.provider).toBe("Stellar Account Indexer");
  });

  it("sets sender as not verified for spam folder", () => {
    const email: Email = { ...baseEmail, folder: "spam" };
    const provenance = getEmailProvenance(email);
    expect(provenance.senderIdentity.isVerified).toBe(false);
  });

  it("sets sender as verified for verified/policy folders", () => {
    const email: Email = { ...baseEmail, folder: "priority" };
    const provenance = getEmailProvenance(email);
    expect(provenance.senderIdentity.isVerified).toBe(true);
  });

  it("marks sender as verified when senderPolicy is set", () => {
    const email: Email = { ...baseEmail, folder: "inbox", senderPolicy: "allow" };
    const provenance = getEmailProvenance(email);
    expect(provenance.senderIdentity.isVerified).toBe(true);
  });

  it("does not verify sender when folder is spam even with senderPolicy", () => {
    const email: Email = { ...baseEmail, folder: "spam", senderPolicy: "allow" };
    const provenance = getEmailProvenance(email);
    expect(provenance.senderIdentity.isVerified).toBe(false);
  });

  it("includes 6 inspector sections", () => {
    const provenance = getEmailProvenance(baseEmail);
    expect(provenance.senderIdentity.inspector).toBeDefined();
    expect(provenance.relaySource.inspector).toBeDefined();
    expect(provenance.messageHash.inspector).toBeDefined();
    expect(provenance.payloadCommitment.inspector).toBeDefined();
    expect(provenance.postageRecord.inspector).toBeDefined();
    expect(provenance.receiptRecord.inspector).toBeDefined();
  });

  it("formats relay node ID deterministically from email id", () => {
    const email: Email = { ...baseEmail, id: "4" };
    const provenance = getEmailProvenance(email);
    expect(provenance.relaySource.nodeId).toBe("Node-05");
  });

  it("produces valid JSON in rawJson for each inspector section", () => {
    const provenance = getEmailProvenance(baseEmail);
    const sections = [
      provenance.senderIdentity.inspector,
      provenance.relaySource.inspector,
      provenance.messageHash.inspector,
      provenance.postageRecord.inspector,
      provenance.receiptRecord.inspector,
    ];
    for (const section of sections) {
      expect(() => JSON.parse(section.rawJson)).not.toThrow();
    }
  });
});
