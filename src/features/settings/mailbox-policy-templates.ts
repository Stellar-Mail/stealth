import type { UiPreferences, UnknownSenderPolicy } from "@/features/preferences";

export type MailboxPolicyTemplateId =
  | "private"
  | "public-paid-inbox"
  | "investor-inbox"
  | "recruiting-inbox"
  | "allowlist-only";

export type MailboxPolicyTemplate = {
  id: MailboxPolicyTemplateId;
  label: string;
  summary: string;
  tradeoff: string;
  senderExperience: string;
  policy: {
    unknownSenders: UnknownSenderPolicy;
    minimumPostage: string;
  };
};

export type SavedMailboxPolicyTemplate = {
  id: "custom";
  label: string;
  summary: string;
  tradeoff: string;
  senderExperience: string;
  policy: {
    unknownSenders: UnknownSenderPolicy;
    minimumPostage: string;
  };
  sourceTemplateId: MailboxPolicyTemplateId | null;
};

export function templateToPreferences(
  template: MailboxPolicyTemplate,
): Pick<UiPreferences, "unknownSenders" | "minimumPostage"> {
  return {
    unknownSenders: template.policy.unknownSenders,
    minimumPostage: template.policy.minimumPostage,
  };
}

export function buildCustomMailboxPolicyTemplate(
  preferences: Pick<UiPreferences, "unknownSenders" | "minimumPostage">,
  sourceTemplateId: MailboxPolicyTemplateId | null,
): SavedMailboxPolicyTemplate {
  return {
    id: "custom",
    label: "Custom draft",
    summary: "Your current inbox policy draft, saved as a reusable custom template.",
    tradeoff:
      "This custom policy is a local draft snapshot and won’t overwrite your current settings until applied.",
    senderExperience:
      "Your current mailbox policy keeps unknown senders and postage values exactly as you set them.",
    policy: {
      unknownSenders: preferences.unknownSenders,
      minimumPostage: preferences.minimumPostage,
    },
    sourceTemplateId,
  };
}

export function savedCustomTemplateToPreferences(
  template: SavedMailboxPolicyTemplate,
): Pick<UiPreferences, "unknownSenders" | "minimumPostage"> {
  return {
    unknownSenders: template.policy.unknownSenders,
    minimumPostage: template.policy.minimumPostage,
  };
}

export function mailboxPolicyTemplateMatchesPreferences(
  template: MailboxPolicyTemplate,
  preferences: Pick<UiPreferences, "unknownSenders" | "minimumPostage">,
) {
  return (
    template.policy.unknownSenders === preferences.unknownSenders &&
    template.policy.minimumPostage === preferences.minimumPostage
  );
}

export function findMailboxPolicyTemplate(
  preferences: Pick<UiPreferences, "unknownSenders" | "minimumPostage">,
): MailboxPolicyTemplate | null {
  return (
    MAILBOX_POLICY_TEMPLATES.find((template) =>
      mailboxPolicyTemplateMatchesPreferences(template, preferences),
    ) ?? null
  );
}

export const MAILBOX_POLICY_TEMPLATES: MailboxPolicyTemplate[] = [
  {
    id: "private",
    label: "Private",
    summary: "Low-friction inbox for personal mail and trusted contacts.",
    tradeoff: "Unknown senders can ask for review, while your inbox stays quiet by default.",
    senderExperience:
      "Trusted contacts arrive normally. Everyone else lands in a review queue unless you approve them.",
    policy: {
      unknownSenders: "request",
      minimumPostage: "0.0001",
    },
  },
  {
    id: "public-paid-inbox",
    label: "Public paid inbox",
    summary: "Open inbox for newsletters, communities, and inbound outreach.",
    tradeoff: "More messages get through, so postage makes noise expensive and discourages spam.",
    senderExperience:
      "Unknown senders can reach you if they pay postage. This is the easiest path for broad inbound mail.",
    policy: {
      unknownSenders: "request",
      minimumPostage: "0.01",
    },
  },
  {
    id: "investor-inbox",
    label: "Investor inbox",
    summary: "Tighter inbox for inbound opportunities and high-signal introductions.",
    tradeoff: "It raises outreach cost and expects verified senders before review.",
    senderExperience:
      "Senders must be verified and pay a meaningful postage amount before their message is worth your time.",
    policy: {
      unknownSenders: "verified",
      minimumPostage: "0.1",
    },
  },
  {
    id: "recruiting-inbox",
    label: "Recruiting inbox",
    summary: "Structured inbox for hiring, introductions, and candidate screening.",
    tradeoff:
      "Forwarding and outreach stay open, but postage keeps casual spam from dominating the queue.",
    senderExperience:
      "Potential candidates can still reach you, but low-effort senders are discouraged by the postage floor.",
    policy: {
      unknownSenders: "request",
      minimumPostage: "0.001",
    },
  },
  {
    id: "allowlist-only",
    label: "Allowlist only",
    summary: "Strict inbox for maximum control and minimal surface area.",
    tradeoff: "Only approved contacts get through, so you trade discoverability for certainty.",
    senderExperience:
      "Unknown senders are rejected up front. Only contacts you already trust can deliver mail.",
    policy: {
      unknownSenders: "block",
      minimumPostage: "0",
    },
  },
];
