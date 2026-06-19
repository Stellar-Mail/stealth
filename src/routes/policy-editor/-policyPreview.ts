export type PolicyPreviewSender = "trusted" | "blocked" | "verified" | "unverified";

export type PolicyPreviewInput = {
  allowUnknown: boolean;
  requireVerified: boolean;
  minimumPostage: number;
};

export type PolicyPreviewResult = {
  allowed: boolean;
  reason: string;
};

export function simulatePolicySender(
  policy: PolicyPreviewInput,
  type: PolicyPreviewSender,
): PolicyPreviewResult {
  if (type === "trusted") {
    return { allowed: true, reason: "Sender is explicitly trusted in contact list." };
  }
  if (type === "blocked") {
    return { allowed: false, reason: "Sender is explicitly blocked." };
  }

  if (!policy.allowUnknown) {
    return { allowed: false, reason: "Unknown senders are disabled completely." };
  }
  if (policy.requireVerified && type === "unverified") {
    return { allowed: false, reason: "Sender lacks verified cryptographic identity." };
  }
  if (policy.minimumPostage > 0) {
    return {
      allowed: true,
      reason: `Allowed if sender attaches >= ${policy.minimumPostage.toFixed(3)} XLM postage.`,
    };
  }
  return { allowed: true, reason: "Allowed freely without restrictions." };
}
