import type { UiPreferences, UnknownSenderPolicy } from "@/features/preferences";

export type MailboxPolicyTemplateId =
  "private" | "public-paid-inbox" | "investor-inbox" | "recruiting-inbox" | "allowlist-only";

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
      "This custom policy is a local draft snapshot and won't overwrite your current settings until applied.",
    senderExperience:
      "Your mailbox follows the exact sender-control and postage values you configured. Review before applying.",
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
    tradeoff:
      "Unknown senders land in a review queue—your inbox stays quiet by default while you decide who gets through.",
    senderExperience:
      "Trusted contacts arrive normally. Everyone else waits in a review queue until you explicitly approve them.",
    policy: {
      unknownSenders: "request",
      minimumPostage: "0.0001",
    },
  },
  {
    id: "public-paid-inbox",
    label: "Public paid inbox",
    summary: "Open inbox for newsletters, communities, and inbound outreach.",
    tradeoff:
      "A small postage floor makes noise expensive—more messages get through, but senders must show intent.",
    senderExperience:
      "Unknown senders can reach you after paying postage. Low-effort or bulk senders are filtered out automatically.",
    policy: {
      unknownSenders: "request",
      minimumPostage: "0.01",
    },
  },
  {
    id: "investor-inbox",
    label: "Investor inbox",
    summary: "Tighter inbox for high-signal inbound opportunities and introductions.",
    tradeoff:
      "Verification and meaningful postage raise the bar—only serious senders who can prove identity get in.",
    senderExperience:
      "Senders must hold a verified cryptographic identity and attach a meaningful postage deposit before their message reaches you.",
    policy: {
      unknownSenders: "verified",
      minimumPostage: "0.1",
    },
  },
  {
    id: "recruiting-inbox",
    label: "Recruiting inbox",
    summary: "Structured inbox for hiring, candidate sourcing, and warm introductions.",
    tradeoff:
      "Postage keeps casual or untargeted outreach out, while still keeping the door open for real candidates.",
    senderExperience:
      "Motivated candidates and referrals can still reach you. Low-effort senders who skip the postage requirement are filtered automatically.",
    policy: {
      unknownSenders: "request",
      minimumPostage: "0.001",
    },
  },
  {
    id: "allowlist-only",
    label: "Allowlist only",
    summary: "Maximum control — only explicitly approved contacts can reach you.",
    tradeoff:
      "Only contacts you trust get through. Unknown senders are rejected immediately, giving you the smallest possible attack surface.",
    senderExperience:
      "Unknown senders are turned away at the door. There is no review queue or postage path — your mailbox is only reachable to people you have approved.",
    policy: {
      unknownSenders: "block",
      minimumPostage: "0",
    },
  },
];
