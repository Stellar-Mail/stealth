import { describe, expect, it } from "vitest";
import {
  simulateSenderAdmission,
  type PolicyControls,
} from "../../../src/routes/policy-editor/simulate-sender";

// A permissive baseline: unknown senders allowed, no verification, no postage.
const openPolicy: PolicyControls = {
  allowUnknown: true,
  requireVerified: false,
  minimumPostage: 0,
};

describe("policy-editor/simulateSenderAdmission", () => {
  it("always allows an explicitly trusted sender (success path)", () => {
    // Trusted wins even under the strictest policy.
    const strict: PolicyControls = {
      allowUnknown: false,
      requireVerified: true,
      minimumPostage: 1,
    };
    const result = simulateSenderAdmission(strict, "trusted");
    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/trusted/i);
  });

  it("always blocks an explicitly blocked sender (failure path)", () => {
    // Blocked loses even under the most permissive policy.
    const result = simulateSenderAdmission(openPolicy, "blocked");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/blocked/i);
  });

  it("rejects unknown senders entirely when allowUnknown is off (edge case)", () => {
    const closed: PolicyControls = { ...openPolicy, allowUnknown: false };
    for (const type of ["verified", "unverified"] as const) {
      const result = simulateSenderAdmission(closed, type);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/disabled/i);
    }
  });

  it("rejects only unverified senders when verification is required", () => {
    const policy: PolicyControls = { ...openPolicy, requireVerified: true };
    expect(simulateSenderAdmission(policy, "unverified").allowed).toBe(false);
    expect(simulateSenderAdmission(policy, "unverified").reason).toMatch(/verified/i);
    // A verified sender still gets through under the same policy.
    expect(simulateSenderAdmission(policy, "verified").allowed).toBe(true);
  });

  it("gates allowed unknown senders behind the postage floor when set", () => {
    const policy: PolicyControls = { ...openPolicy, minimumPostage: 0.05 };
    const result = simulateSenderAdmission(policy, "verified");
    expect(result.allowed).toBe(true);
    // The reason surfaces the exact postage floor, formatted to 3 decimals.
    expect(result.reason).toContain("0.050 XLM");
  });

  it("allows unknown senders freely when no postage floor is set", () => {
    const result = simulateSenderAdmission(openPolicy, "unverified");
    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/freely/i);
  });

  it("blocks unverified senders regardless of postage when verification is required", () => {
    // requireVerified takes precedence over the postage allowance.
    const policy: PolicyControls = {
      allowUnknown: true,
      requireVerified: true,
      minimumPostage: 0.5,
    };
    expect(simulateSenderAdmission(policy, "unverified").allowed).toBe(false);
  });
});
