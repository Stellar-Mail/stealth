export type SimulatedSenderType = "trusted" | "blocked" | "verified" | "unverified";

export type PolicyControls = {
  allowUnknown: boolean;
  requireVerified: boolean;
  /** Minimum postage in XLM. */
  minimumPostage: number;
};

export type SenderAdmission = {
  allowed: boolean;
  reason: string;
};

/**
 * Pure preview of how the current draft policy would treat a representative
 * sender, powering the Policy Editor's live simulator. This is an illustrative
 * approximation for the editor UI, not the authoritative server-side admission
 * decision. Extracted from the route so the admission logic can be regression
 * tested without rendering the page.
 */
export function simulateSenderAdmission(
  controls: PolicyControls,
  type: SimulatedSenderType,
): SenderAdmission {
  if (type === "trusted") {
    return { allowed: true, reason: "Sender is explicitly trusted in contact list." };
  }
  if (type === "blocked") {
    return { allowed: false, reason: "Sender is explicitly blocked." };
  }
  if (!controls.allowUnknown) {
    return { allowed: false, reason: "Unknown senders are disabled completely." };
  }
  if (controls.requireVerified && type === "unverified") {
    return { allowed: false, reason: "Sender lacks verified cryptographic identity." };
  }
  if (controls.minimumPostage > 0) {
    return {
      allowed: true,
      reason: `Allowed if sender attaches >= ${controls.minimumPostage.toFixed(3)} XLM postage.`,
    };
  }
  return { allowed: true, reason: "Allowed freely without restrictions." };
}
