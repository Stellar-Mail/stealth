/**
 * Stealth & Stellar Federation Protocol Helpers (BETA-003 & BETA-026)
 *
 * Handles canonical mapping between Stealth email identities (user@stealth.me)
 * and Stellar federation handles (user*stealth.me).
 */

export const DEFAULT_FEDERATION_DOMAIN = "stealth.me";

export interface FederationIdentifier {
  username: string;
  domain: string;
  canonicalEmail: string;
  federationHandle: string;
}

/**
 * Converts a raw handle or email string into a canonical Stealth email (user@domain).
 */
export function formatStealthEmail(username: string, domain = DEFAULT_FEDERATION_DOMAIN): string {
  const norm = username.toLowerCase().trim();
  return `${norm}@${domain}`;
}

/**
 * Converts a raw handle or email string into a canonical Stellar federation handle (user*domain).
 */
export function formatStellarFederation(
  username: string,
  domain = DEFAULT_FEDERATION_DOMAIN,
): string {
  const norm = username.toLowerCase().trim();
  return `${norm}*${domain}`;
}

/**
 * Parses an incoming identifier (user@domain or user*domain) into a FederationIdentifier struct.
 */
export function parseFederationIdentifier(
  identifier: string,
  defaultDomain = DEFAULT_FEDERATION_DOMAIN,
): FederationIdentifier | null {
  if (!identifier || typeof identifier !== "string") return null;

  const trimmed = identifier.trim().toLowerCase();
  let username = trimmed;
  let domain = defaultDomain;

  if (trimmed.includes("*")) {
    const parts = trimmed.split("*");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    username = parts[0];
    domain = parts[1];
  } else if (trimmed.includes("@")) {
    const parts = trimmed.split("@");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    username = parts[0];
    domain = parts[1];
  }

  return {
    username,
    domain,
    canonicalEmail: `${username}@${domain}`,
    federationHandle: `${username}*${domain}`,
  };
}
