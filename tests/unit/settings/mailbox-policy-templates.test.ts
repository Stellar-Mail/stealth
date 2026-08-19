import { describe, expect, it } from "vitest";

import {
  MAILBOX_POLICY_TEMPLATES,
  buildCustomMailboxPolicyTemplate,
  findMailboxPolicyTemplate,
  mailboxPolicyTemplateMatchesPolicy,
  savedCustomTemplateToPolicy,
  templateToPolicy,
  type MailboxPolicyTemplateId,
} from "../../../src/features/settings/mailbox-policy-templates";

describe("mailbox policy templates", () => {
  it("finds the matching template for a standard request policy", () => {
    const policy = { allowUnknown: true, requireVerified: false, minimumPostage: "0.0001" };
    expect(findMailboxPolicyTemplate(policy as any)?.id).toBe("private");
  });

  it("finds the allowlist-only template when unknown senders are blocked", () => {
    const policy = { allowUnknown: false, requireVerified: false, minimumPostage: "0" };
    expect(findMailboxPolicyTemplate(policy as any)?.id).toBe("allowlist-only");
  });

  it("maps a template to the correct policy values", () => {
    const template = MAILBOX_POLICY_TEMPLATES.find((item) => item.id === "investor-inbox") as any;

    expect(templateToPolicy(template)).toEqual({
      allowUnknown: true,
      requireVerified: true,
      minimumPostage: "0.1",
    });
  });

  it("builds a reusable saved custom template from a policy", () => {
    const policy = { allowUnknown: true, requireVerified: true, minimumPostage: "0.25" };
    const saved = buildCustomMailboxPolicyTemplate(policy as any, "investor-inbox");

    expect(saved.id).toBe("custom");
    expect(saved.sourceTemplateId).toBe("investor-inbox");
    expect(saved.policy).toEqual({
      allowUnknown: true,
      requireVerified: true,
      minimumPostage: "0.25",
    });
  });

  it("rehydrates a saved custom template back into a policy", () => {
    const saved = buildCustomMailboxPolicyTemplate(
      { allowUnknown: true, requireVerified: false, minimumPostage: "0.01" } as any,
      null,
    );
    expect(savedCustomTemplateToPolicy(saved)).toEqual({
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0.01",
    });
  });

  it("recognizes matching and non-matching template policies", () => {
    const template = MAILBOX_POLICY_TEMPLATES.find(
      (item) => item.id === "public-paid-inbox",
    ) as any;

    expect(
      mailboxPolicyTemplateMatchesPolicy(template, {
        allowUnknown: true,
        requireVerified: false,
        minimumPostage: "0.01",
      } as any),
    ).toBe(true);

    expect(
      mailboxPolicyTemplateMatchesPolicy(template, {
        allowUnknown: true,
        requireVerified: false,
        minimumPostage: "0.001",
      } as any),
    ).toBe(false);
  });
});
