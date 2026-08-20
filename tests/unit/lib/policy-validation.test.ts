import { describe, expect, it } from "vitest";

import {
  validateMinimumPostage,
  validatePolicyWrite,
  policiesEqual,
  computeDirtyFields,
  validateSenderRule,
} from "../../../src/lib/policy-validation";

describe("validateMinimumPostage", () => {
  it("accepts valid postage strings", () => {
    expect(validateMinimumPostage("0")).toBeNull();
    expect(validateMinimumPostage("0.001")).toBeNull();
    expect(validateMinimumPostage("1")).toBeNull();
    expect(validateMinimumPostage("0.5")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(validateMinimumPostage("")).toBe("Minimum postage is required.");
  });

  it("rejects non-numeric strings", () => {
    expect(validateMinimumPostage("abc")).toBe("Enter a valid number.");
    expect(validateMinimumPostage("NaN")).toBe("Enter a valid number.");
    expect(validateMinimumPostage("Infinity")).toBe("Enter a valid number.");
  });

  it("rejects negative values", () => {
    expect(validateMinimumPostage("-0.01")).toBe("Postage cannot be negative.");
  });

  it("rejects values exceeding max", () => {
    expect(validateMinimumPostage("1.001")).toBe("Postage cannot exceed 1 XLM.");
    expect(validateMinimumPostage("100")).toBe("Postage cannot exceed 1 XLM.");
  });
});

describe("validatePolicyWrite", () => {
  it("returns no errors for a valid policy", () => {
    const errors = validatePolicyWrite({
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0.01",
    });
    expect(errors).toEqual({});
  });

  it("catches invalid postage", () => {
    const errors = validatePolicyWrite({
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "-1",
    });
    expect(errors.minimumPostage).toBeDefined();
  });

  it("catches requireVerified with allowUnknown=false", () => {
    const errors = validatePolicyWrite({
      allowUnknown: false,
      requireVerified: true,
      minimumPostage: "0",
    });
    expect(errors.requireVerified).toBeDefined();
  });

  it("allows requireVerified with allowUnknown=true", () => {
    const errors = validatePolicyWrite({
      allowUnknown: true,
      requireVerified: true,
      minimumPostage: "0.1",
    });
    expect(errors).toEqual({});
  });
});

describe("policiesEqual", () => {
  const base = { allowUnknown: true, requireVerified: false, minimumPostage: "0.01" };

  it("returns true for identical policies", () => {
    expect(policiesEqual(base, { ...base })).toBe(true);
  });

  it("returns false when allowUnknown differs", () => {
    expect(policiesEqual(base, { ...base, allowUnknown: false })).toBe(false);
  });

  it("returns false when requireVerified differs", () => {
    expect(policiesEqual(base, { ...base, requireVerified: true })).toBe(false);
  });

  it("returns false when minimumPostage differs", () => {
    expect(policiesEqual(base, { ...base, minimumPostage: "0.02" })).toBe(false);
  });
});

describe("computeDirtyFields", () => {
  const live = { allowUnknown: true, requireVerified: false, minimumPostage: "0.01" };

  it("returns empty array when no changes", () => {
    expect(computeDirtyFields({ ...live }, live)).toEqual([]);
  });

  it("detects changed fields", () => {
    const draft = { ...live, allowUnknown: false, minimumPostage: "0.5" };
    const dirty = computeDirtyFields(draft, live);
    expect(dirty).toContain("allowUnknown");
    expect(dirty).toContain("minimumPostage");
    expect(dirty).not.toContain("requireVerified");
  });
});

describe("validateSenderRule", () => {
  const owner = `G${"A".repeat(55)}`;

  it("blocks self-block action", () => {
    expect(validateSenderRule(owner, owner, "block")).toBe("You cannot block your own address.");
  });

  it("allows blocking a different sender", () => {
    const sender = `G${"B".repeat(55)}`;
    expect(validateSenderRule(owner, sender, "block")).toBeNull();
  });

  it("allows any sender rule other than block on self", () => {
    expect(validateSenderRule(owner, owner, "allow")).toBeNull();
    expect(validateSenderRule(owner, owner, "default")).toBeNull();
  });
});
