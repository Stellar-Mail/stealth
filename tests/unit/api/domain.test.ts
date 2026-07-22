import { describe, expect, it } from "vitest";

import {
  hash32Schema,
  mailboxPolicySchema,
  stellarAddressSchema,
  stroopAmountSchema,
} from "../../../src/server/api/domain";

const address = `G${"A".repeat(55)}`;

describe("API domain schemas", () => {
  it("accepts contract-safe policy values", () => {
    expect(
      mailboxPolicySchema.parse({
        allowUnknown: false,
        minimumPostage: "10000000",
        requireVerified: true,
      }),
    ).toEqual({
      allowUnknown: false,
      minimumPostage: "10000000",
      requireVerified: true,
    });
  });

  it("enforces Stellar addresses and 32-byte hashes", () => {
    expect(stellarAddressSchema.parse(address)).toBe(address);
    // Add normalization tests for canonical address handling
    expect(stellarAddressSchema.parse(address.toLowerCase())).toBe(address);
    expect(stellarAddressSchema.parse(`  ${address.toLowerCase()}  `)).toBe(address);

    expect(hash32Schema.parse("a".repeat(64))).toBe("a".repeat(64));
    expect(() => stellarAddressSchema.parse("eve*stealth.xyz")).toThrow();
    expect(() => hash32Schema.parse("abc")).toThrow();
  });

  it("keeps Soroban i128 amounts as decimal strings", () => {
    expect(stroopAmountSchema.parse("9007199254740993")).toBe("9007199254740993");
    expect(() => stroopAmountSchema.parse("-1")).toThrow();
  });
});
