import { describe, expect, it } from "vitest";
import { simulatePolicySender } from "./-policyPreview";

describe("policy editor preview", () => {
  it("allows verified senders freely when unknown senders are allowed with no postage", () => {
    expect(
      simulatePolicySender(
        { allowUnknown: true, requireVerified: false, minimumPostage: 0 },
        "verified",
      ),
    ).toEqual({
      allowed: true,
      reason: "Allowed freely without restrictions.",
    });
  });

  it("blocks unknown senders before applying verification or postage rules", () => {
    expect(
      simulatePolicySender(
        { allowUnknown: false, requireVerified: true, minimumPostage: 0.25 },
        "verified",
      ),
    ).toEqual({
      allowed: false,
      reason: "Unknown senders are disabled completely.",
    });
  });

  it("blocks unverified senders when verification is required", () => {
    expect(
      simulatePolicySender(
        { allowUnknown: true, requireVerified: true, minimumPostage: 0.01 },
        "unverified",
      ),
    ).toEqual({
      allowed: false,
      reason: "Sender lacks verified cryptographic identity.",
    });
  });

  it("shows the postage requirement for allowed unknown senders", () => {
    expect(
      simulatePolicySender(
        { allowUnknown: true, requireVerified: false, minimumPostage: 0.015 },
        "unverified",
      ),
    ).toEqual({
      allowed: true,
      reason: "Allowed if sender attaches >= 0.015 XLM postage.",
    });
  });
});
