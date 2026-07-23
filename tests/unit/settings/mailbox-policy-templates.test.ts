import { describe, expect, it } from "vitest";

import {
  MAILBOX_POLICY_TEMPLATES,
  buildCustomMailboxPolicyTemplate,
  findMailboxPolicyTemplate,
  mailboxPolicyTemplateMatchesPreferences,
  savedCustomTemplateToPreferences,
  templateToPreferences,
  type MailboxPolicyTemplateId,
} from "../../../src/features/settings/mailbox-policy-templates";

describe("mailbox policy templates", () => {
  it("finds the matching template for a standard request policy", () => {
    const preferences = { unknownSenders: "request", minimumPostage: "0.0001" };
    expect(findMailboxPolicyTemplate(preferences as any)?.id).toBe("private");
  });

  it("finds the allowlist-only template when unknown senders are blocked", () => {
    const preferences = { unknownSenders: "block", minimumPostage: "0" };
    expect(findMailboxPolicyTemplate(preferences as any)?.id).toBe("allowlist-only");
  });

  it("maps a template to the correct preference values", () => {
    const template = MAILBOX_POLICY_TEMPLATES.find((item) => item.id === "investor-inbox") as any;

    expect(templateToPreferences(template)).toEqual({
      unknownSenders: "verified",
      minimumPostage: "0.1",
    });
  });

  it("builds a reusable saved custom template from preferences", () => {
    const preferences = { unknownSenders: "verified", minimumPostage: "0.25" };
    const saved = buildCustomMailboxPolicyTemplate(preferences as any, "investor-inbox");

    expect(saved.id).toBe("custom");
    expect(saved.sourceTemplateId).toBe("investor-inbox");
    expect(saved.policy).toEqual({ unknownSenders: "verified", minimumPostage: "0.25" });
  });

  it("rehydrates a saved custom template back into preferences", () => {
    const saved = buildCustomMailboxPolicyTemplate(
      { unknownSenders: "request", minimumPostage: "0.01" } as any,
      null,
    );
    expect(savedCustomTemplateToPreferences(saved)).toEqual({
      unknownSenders: "request",
      minimumPostage: "0.01",
    });
  });

  it("recognizes matching and non-matching template preferences", () => {
    const template = MAILBOX_POLICY_TEMPLATES.find(
      (item) => item.id === "public-paid-inbox",
    ) as any;

    expect(
      mailboxPolicyTemplateMatchesPreferences(template, {
        unknownSenders: "request",
        minimumPostage: "0.01",
      } as any),
    ).toBe(true);

    expect(
      mailboxPolicyTemplateMatchesPreferences(template, {
        unknownSenders: "request",
        minimumPostage: "0.001",
      } as any),
    ).toBe(false);
  });
});
