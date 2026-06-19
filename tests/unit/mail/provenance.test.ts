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

describe("mail/provenance formatted identifiers", () => {
  const baseEmail: Email = {
    id: "42",
    from: "Bob Sender",
    email: "bob@stealth.network",
    subject: "Formatted ID test",
    preview: "preview",
    body: "body",
    time: "3:00 PM",
    unread: false,
    starred: false,
    folder: "inbox",
    avatarColor: "#0ea5e9",
  };

  it("formats resolved public key as start...end truncation", () => {
    const provenance = getEmailProvenance(baseEmail);
    const formatted = provenance.senderIdentity.resolvedFormatted;
    // Should be "GXXXXX...XXXXXX" with 6+6 chars around "..."
    expect(formatted).toMatch(/^G.{5}\.\.\..{6}$/);
  });

  it("formats relay pubkey as start...end truncation", () => {
    const provenance = getEmailProvenance(baseEmail);
    const formatted = provenance.relaySource.pubkeyFormatted;
    expect(formatted).toMatch(/^G.{5}\.\.\..{6}$/);
  });

  it("formats message hash as start...end truncation", () => {
    const provenance = getEmailProvenance(baseEmail);
    const formatted = provenance.messageHash.formatted;
    expect(formatted).toMatch(/^.{6}\.\.\..{6}$/);
  });

  it("formats postage tx hash as start...end truncation", () => {
    const provenance = getEmailProvenance(baseEmail);
    const formatted = provenance.postageRecord.txHashFormatted;
    expect(formatted).toMatch(/^.{6}\.\.\..{6}$/);
  });

  it("formats escrow address starting with C", () => {
    const provenance = getEmailProvenance(baseEmail);
    expect(provenance.postageRecord.escrowAddress).toMatch(/^C[A-Z2-7]{55}$/);
  });
});

describe("mail/provenance SMTP bridge detection", () => {
  it("detects bridge via 'bridge' in sender name", () => {
    const bridgeEmail: Email = {
      id: "7",
      from: "smtp-bridge relay",
      email: "smtp@bridge.example.com",
      subject: "Bridge detection",
      preview: "",
      body: "",
      time: "noon",
      unread: false,
      starred: false,
      folder: "inbox",
      avatarColor: "#f59e0b",
    };
    const provenance = getEmailProvenance(bridgeEmail);
    expect(provenance.senderIdentity.isVerified).toBe(false);
    expect(provenance.postageRecord.status).toBe("Bypassed (Bridge Route)");
    expect(provenance.receiptRecord.status).toBe("Not Requested");
  });

  it("treats spam folder as bridged", () => {
    const spamEmail: Email = {
      id: "8",
      from: "Spammer",
      email: "spam@example.com",
      subject: "Buy now",
      preview: "",
      body: "",
      time: "noon",
      unread: false,
      starred: false,
      folder: "spam",
      avatarColor: "#ef4444",
    };
    const provenance = getEmailProvenance(spamEmail);
    expect(provenance.postageRecord.status).toBe("Bypassed (Bridge Route)");
  });
});

describe("mail/provenance request postage status", () => {
  it("holds postage in escrow for request folder", () => {
    const requestEmail: Email = {
      id: "9",
      from: "Unknown Sender",
      email: "unknown@example.com",
      subject: "Please accept me",
      preview: "",
      body: "",
      time: "noon",
      unread: true,
      starred: false,
      folder: "requests",
      avatarColor: "#8b5cf6",
    };
    const provenance = getEmailProvenance(requestEmail);
    expect(provenance.postageRecord.status).toBe("Held in Escrow");
    expect(provenance.postageRecord.amount).toBe("0.00500 XLM");
  });

  it("settles postage for verified folder messages", () => {
    const verifiedEmail: Email = {
      id: "10",
      from: "Carol Verified",
      email: "carol@stealth.network",
      subject: "Verified message",
      preview: "",
      body: "",
      time: "noon",
      unread: false,
      starred: false,
      folder: "verified",
      avatarColor: "#10b981",
    };
    const provenance = getEmailProvenance(verifiedEmail);
    expect(provenance.postageRecord.status).toBe("Settled / Fees Burned");
  });
});
