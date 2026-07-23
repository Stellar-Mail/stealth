import { describe, expect, it } from "vitest";
import {
  buildSignaturePreimage,
  STEALTH_DOMAIN_TAG,
  STEALTH_PROTOCOL_VERSION,
} from "./signing-preimage";

describe("services/crypto/signing-preimage", () => {
  it("builds a deterministic domain-separated preimage", () => {
    const payload = '{"key":"value"}';
    const result = buildSignaturePreimage(payload, {
      network: "testnet",
      operation: "envelope_signature",
    });

    const expectedString = `${STEALTH_DOMAIN_TAG}:${STEALTH_PROTOCOL_VERSION}:testnet:envelope_signature:{"key":"value"}`;
    const expectedBytes = new TextEncoder().encode(expectedString);

    expect(result).toEqual(expectedBytes);
  });

  it("allows overriding the protocol version", () => {
    const result = buildSignaturePreimage("data", {
      network: "public",
      operation: "op",
      version: "v2",
    });

    const expectedString = `${STEALTH_DOMAIN_TAG}:v2:public:op:data`;
    expect(new TextDecoder().decode(result)).toBe(expectedString);
  });

  it("should fail validation if domain tag conceptually changes (represented by different output)", () => {
    const payload = '{"key":"value"}';
    const result = buildSignaturePreimage(payload, {
      network: "testnet",
      operation: "envelope_signature",
    });

    const wrongDomainString = `Wrong_Domain:${STEALTH_PROTOCOL_VERSION}:testnet:envelope_signature:{"key":"value"}`;
    const wrongBytes = new TextEncoder().encode(wrongDomainString);

    expect(result).not.toEqual(wrongBytes);
  });
});
