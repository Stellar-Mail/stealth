import { describe, expect, it } from "vitest";

import {
  canBindIdentities,
  IdentityError,
  isFederationAddress,
  isValidAccountAddress,
  normalizeIdentity,
  type IdentityKind,
} from "../../../src/services/crypto/identity";

// A structurally valid-looking G-address (56 chars, G + base32 chars). Real
// ed25519 keys would checksum, but the module validates structure only.
const VALID_ACCOUNT = "G" + "A".repeat(54) + "C";
const FEDERATION = "alice*stellar.org";

describe("identity normalizer (#1732)", () => {
  it("accepts a canonical account address", () => {
    const id = normalizeIdentity(VALID_ACCOUNT);
    expect(id.kind).toBe<IdentityKind>("account");
    expect(id.canonical).toBe(VALID_ACCOUNT);
  });

  it("trims surrounding whitespace before validating", () => {
    const id = normalizeIdentity(`  ${VALID_ACCOUNT}  `);
    expect(id.canonical).toBe(VALID_ACCOUNT);
  });

  it("rejects malformed (too short) account addresses", () => {
    expect(() => normalizeIdentity("GABC")).toThrowError(IdentityError);
  });

  it("rejects addresses with invalid base32 characters", () => {
    const bad = "G" + "0".repeat(55); // '0' is not in the Stellar base32 alphabet
    expect(isValidAccountAddress(bad)).toBe(false);
    expect(() => normalizeIdentity(bad)).toThrowError(IdentityError);
  });

  it("rejects the empty / whitespace-only identifier", () => {
    expect(() => normalizeIdentity("   ")).toThrowError(IdentityError);
  });

  it("recognizes federation addresses without fabricating a canonical account", () => {
    expect(isFederationAddress(FEDERATION)).toBe(true);
    const id = normalizeIdentity(FEDERATION);
    expect(id.kind).toBe<IdentityKind>("federation");
    // No unverified account is substituted for the display form.
    expect(id.canonical).toBe(FEDERATION);
  });

  it("rejects ambiguous forms that are neither account nor federation", () => {
    expect(() => normalizeIdentity("not-an-address")).toThrowError(IdentityError);
    expect(() => normalizeIdentity("alice@stellar.org")).toThrowError(IdentityError);
  });

  it("only account addresses are directly bindable", () => {
    const account = normalizeIdentity(VALID_ACCOUNT);
    const fed = normalizeIdentity(FEDERATION);
    expect(canBindIdentities(account, account)).toBe(true);
    expect(canBindIdentities(account, fed)).toBe(false);
  });
});
