import { describe, it, expect } from "vitest";
import { validateComposeDraft, type RecipientReadiness } from "@/components/mail/composeValidation";

describe("composeValidation", () => {
  const baseDraft = {
    to: "alice*stellar.org",
    body: "Hello World",
    postage: "0",
  };

  it("should fail validation if message body is empty", () => {
    const draft = { ...baseDraft, body: "" };
    const err = validateComposeDraft(draft);
    expect(err).toBe("Please enter a message");
  });

  it("should fail validation if recipient resolution is stale", () => {
    const expiredTime = new Date(Date.now() - 10000).toISOString();
    const resolvedRecipients: RecipientReadiness[] = [
      {
        address: "alice*stellar.org",
        state: "verified",
        postage: "ready",
        message: "Resolved",
        expiresAt: expiredTime,
      },
    ];

    const draft = { ...baseDraft, resolvedRecipients };
    const err = validateComposeDraft(draft);
    expect(err).toBe("Recipient resolution is stale — re-resolving…");
  });

  it("should fail validation if policy quote is expired", () => {
    const expiredTime = new Date(Date.now() - 10000).toISOString();
    const resolvedRecipients: RecipientReadiness[] = [
      {
        address: "alice*stellar.org",
        state: "verified",
        postage: "ready",
        message: "Resolved",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    ];

    const policyQuote = {
      id: "quote-1",
      amount: "10000000",
      eligible: true,
      trusted: false,
      reason: "mailbox_minimum" as const,
      expiresAt: expiredTime,
    };

    const draft = { ...baseDraft, resolvedRecipients, policyQuote };
    const err = validateComposeDraft(draft);
    expect(err).toBe("Policy quote is expired — re-quoting…");
  });

  it("should fail validation if recipient key is revoked", () => {
    const resolvedRecipients: RecipientReadiness[] = [
      {
        address: "alice*stellar.org",
        state: "verified",
        postage: "ready",
        message: "Key Revoked",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        keyStatus: "revoked",
      },
    ];

    const draft = { ...baseDraft, resolvedRecipients };
    const err = validateComposeDraft(draft);
    expect(err).toBe("Recipient encryption key has been revoked");
  });
});
