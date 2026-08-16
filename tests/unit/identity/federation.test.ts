import { describe, expect, it } from "vitest";

import {
  STEALTH_FEDERATION_DOMAIN,
  toFederationAddress,
  toStealthAddress,
} from "../../../src/features/identity/federation";
import { usernameSchema } from "../../../src/features/identity/username";

describe("federation address mapping", () => {
  it("maps a canonical username to its Stealth address", () => {
    const canonical = usernameSchema.parse("alice");
    expect(toStealthAddress(canonical)).toBe(`alice@${STEALTH_FEDERATION_DOMAIN}`);
    expect(toStealthAddress(canonical)).toBe("alice@stealth.me");
  });

  it("maps a canonical username to its Stellar federation address", () => {
    const canonical = usernameSchema.parse("alice");
    expect(toFederationAddress(canonical)).toBe(`alice*${STEALTH_FEDERATION_DOMAIN}`);
    expect(toFederationAddress(canonical)).toBe("alice*stealth.me");
  });

  it("the two forms differ only by separator, never by the username itself", () => {
    const canonical = usernameSchema.parse("bob-99");
    const stealth = toStealthAddress(canonical);
    const federation = toFederationAddress(canonical);
    expect(stealth.replace("@", "*")).toBe(federation);
  });
});
