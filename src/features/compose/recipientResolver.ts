import type { RecipientReadiness } from "@/components/mail/composeValidation";

export type RecipientResolutionContext = {
  /** Resolve a contact by name or address */
  resolveContact?: (input: string) => Promise<{
    id: string;
    name: string;
    address: string;
    publicKey?: string;
    trusted?: boolean;
  } | null>;

  /** Resolve a Stellar federation address (name*domain) */
  resolveFederation?: (address: string) => Promise<{
    publicKey: string;
    domain: string;
  } | null>;

  /** Get user's policy for unverified recipients */
  getUnverifiedPolicy?: () => Promise<"allow" | "block" | "review">;

  /** Check if recipient is explicitly blocked */
  isBlockedRecipient?: (address: string) => Promise<boolean>;
};

/**
 * Resolves a single recipient address to determine if it's valid, verified, unknown, or blocked.
 * Supports:
 * - Stealth addresses (S...)
 * - Stellar G-addresses (G...)
 * - Federation addresses (name*domain)
 * - Aliases
 * - Contacts
 *
 * @param address The recipient address to resolve
 * @param blockedRecipients Local set of blocked addresses for quick filtering
 * @param context Optional resolution context for contact/federation lookup
 */
export async function resolveRecipient(
  address: string,
  blockedRecipients: Set<string>,
  context?: RecipientResolutionContext,
): Promise<RecipientReadiness> {
  const normalized = address.toLowerCase().trim();

  // Check if blocked locally first (fast path)
  if (blockedRecipients.has(normalized)) {
    return {
      address,
      state: "blocked",
      postage: "required",
      message: "This recipient is blocked",
      policyType: "block",
    };
  }

  // Validate format
  const validation = validateRecipientFormat(normalized);
  if (!validation.valid) {
    return {
      address,
      state: "invalid",
      postage: "required",
      message: validation.error || "Invalid address format",
    };
  }

  // Check if blocked via context (async check)
  if (context?.isBlockedRecipient) {
    const isBlocked = await context.isBlockedRecipient(normalized);
    if (isBlocked) {
      return {
        address,
        state: "blocked",
        postage: "required",
        message: "This recipient is blocked",
        policyType: "block",
      };
    }
  }

  // Try to resolve via contact database
  if (context?.resolveContact && !isStellarFormat(normalized)) {
    try {
      const contact = await context.resolveContact(normalized);
      if (contact) {
        return {
          address,
          state: "verified",
          postage: "required",
          message: `Contact verified: ${contact.name}`,
          resolvedAccount: contact.address,
          policyType: contact.trusted ? "allow" : "default",
          encryptionKey: contact.publicKey,
        };
      }
    } catch (error) {
      console.warn(`Failed to resolve contact for ${address}:`, error);
    }
  }

  // Try to resolve via federation if it's a federation address
  if (isFederationFormat(normalized) && context?.resolveFederation) {
    try {
      const result = await context.resolveFederation(normalized);
      if (result) {
        return {
          address,
          state: "verified",
          postage: "required",
          message: `Resolved via Stellar federation (${result.domain})`,
          resolvedAccount: result.publicKey,
          policyType: "default",
          encryptionKey: result.publicKey,
        };
      }
    } catch (error) {
      console.warn(`Failed to resolve federation address ${address}:`, error);
    }
  }

  // Default: unknown but valid format
  return {
    address,
    state: "unknown",
    postage: "required",
    message: "Recipient address unresolved — verification pending",
    policyType: "default",
  };
}

/**
 * Helper to check if address is already in Stellar format (G or S prefix)
 */
function isStellarFormat(address: string): boolean {
  return /^[GS][A-Z0-9]{55}$/.test(address);
}

/**
 * Helper to check if address is a federation address (name*domain)
 */
function isFederationFormat(address: string): boolean {
  return /\*/.test(address) && address.includes(".");
}

/**
 * Batch resolve multiple recipients
 */
export async function resolveRecipients(
  addresses: string[],
  blockedRecipients: string[] = [],
  context?: RecipientResolutionContext,
): Promise<RecipientReadiness[]> {
  const blockedSet = new Set(blockedRecipients.map((r) => r.toLowerCase().trim()));
  return Promise.all(addresses.map((addr) => resolveRecipient(addr, blockedSet, context)));
}

/**
 * Validate recipient address format
 */
function validateRecipientFormat(address: string): { valid: boolean; error?: string } {
  const trimmed = address.trim();

  if (!trimmed) {
    return { valid: false, error: "Address is required" };
  }

  // Stealth address (S...)
  if (/^S[A-Z0-9]{55}$/.test(trimmed)) {
    return { valid: true };
  }

  // Stellar G-address (56 chars, starts with G)
  if (/^G[A-Z2-7]{55}$/.test(trimmed)) {
    return { valid: true };
  }

  // Federation address (name*domain)
  if (/^[a-zA-Z0-9._-]+\*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return { valid: true };
  }

  // Alias (simple string, no spaces or special chars except hyphen/underscore)
  if (/^[a-zA-Z0-9._-]{3,}$/.test(trimmed) && !trimmed.includes("@")) {
    return { valid: true };
  }

  return {
    valid: false,
    error:
      "Enter a Stealth address, Stellar address, federation address (name*domain), or contact alias",
  };
}
