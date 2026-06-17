export type Attachment = {
  name: string;
  size: string;
  type: "file" | "image";
};

export type ComposeMode = "compose" | "reply" | "reply-all" | "forward" | "schedule";

export type RecipientResolutionState = "resolving" | "verified" | "unknown" | "invalid" | "blocked";

export type RecipientReadiness = {
  address: string;
  state: RecipientResolutionState;
  postage: "ready" | "required";
  message: string;
  resolvedAccount?: string; // Stealth address if resolved
  policyType?: "allow" | "block" | "default"; // Trust policy
  encryptionKey?: string; // Public key for encryption
};

export type ComposeDraft = {
  to: string;
  subject?: string;
  body: string;
  postage: string;
  blockedRecipients?: string[];
};

export type ComposeSubmission = {
  to: string;
  subject: string;
  body: string;
  attachments: Attachment[];
  encrypted: boolean;
  receipt: boolean;
  postage: string;
  scheduled: boolean;
  mode?: ComposeMode;
};

export function parseRecipients(value: string) {
  return value
    .split(/[;,]/)
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

/**
 * Get initial recipient readiness (synchronous, for instant feedback)
 * This is used before async resolution kicks in - shows "resolving" state
 */
export function getRecipientReadiness(
  value: string,
  postage: string,
  blockedRecipients: string[] = [],
): RecipientReadiness[] {
  const blocked = new Set(blockedRecipients.map((recipient) => recipient.toLowerCase().trim()));
  const postageReady = Number.parseFloat(postage) > 0;

  return parseRecipients(value).map((address) => {
    const normalized = address.toLowerCase();
    const isBlocked = blocked.has(normalized);

    // Initial state while resolving
    return {
      address,
      state: "resolving",
      postage: postageReady ? "ready" : "required",
      message: "Resolving recipient address…",
      policyType: isBlocked ? "block" : "default",
    };
  });
}

export function validateComposeDraft({ to, body, postage, blockedRecipients = [] }: ComposeDraft) {
  const recipients = getRecipientReadiness(to, postage, blockedRecipients);

  if (!recipients.length) return "Please enter a recipient";
  if (!body.trim()) return "Please enter a message";

  // Check for blocked recipients
  if (recipients.some((recipient) => recipient.state === "blocked")) {
    return "Remove blocked recipients before sending";
  }

  // Check for unresolved or invalid recipients (unless explicitly allowed by future rules)
  if (
    recipients.some((recipient) => recipient.state === "resolving" || recipient.state === "invalid")
  ) {
    return "All recipients must be verified before sending";
  }

  // Check postage
  if (recipients.some((recipient) => recipient.postage === "required")) {
    return "Add postage before sending";
  }

  return null;
}
