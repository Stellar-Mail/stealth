/**
 * Domain-separated signature preimage.
 *
 * Prevents signature replay across different protocols, networks, or operations.
 */

export const STEALTH_DOMAIN_TAG = "Stealth_Mail_Protocol";
export const STEALTH_PROTOCOL_VERSION = "v1";

export interface SignaturePreimageOptions {
  network: string;
  operation: string;
  version?: string;
}

/**
 * Builds a deterministic, domain-separated signature preimage byte array.
 * By incorporating the domain tag, network, protocol version, and operation,
 * we prevent cross-protocol and cross-network signature reuse attacks.
 */
export function buildSignaturePreimage(
  canonicalPayload: string,
  options: SignaturePreimageOptions,
): Uint8Array {
  const version = options.version ?? STEALTH_PROTOCOL_VERSION;

  const prefix = [STEALTH_DOMAIN_TAG, version, options.network, options.operation].join(":");

  const preimageStr = `${prefix}:${canonicalPayload}`;
  return new TextEncoder().encode(preimageStr);
}
