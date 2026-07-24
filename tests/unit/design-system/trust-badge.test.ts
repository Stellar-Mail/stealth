import { describe, expect, it } from "vitest";

import { TRUST_STATE_META, type TrustState } from "@/features/design-system";

const ALL_TRUST_STATES: TrustState[] = [
  "verified",
  "allowed",
  "unknown",
  "paid",
  "blocked",
  "bridged",
  "encrypted",
];

describe("TRUST_STATE_META", () => {
  it("defines user-visible labels for every canonical trust state (success path)", () => {
    for (const state of ALL_TRUST_STATES) {
      const meta = TRUST_STATE_META[state];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.tooltip.length).toBeGreaterThan(0);
      expect(meta.icon).toBeDefined();
    }
  });

  it("keeps text styling tokens on every badge so color is never the only cue", () => {
    for (const state of ALL_TRUST_STATES) {
      const { className } = TRUST_STATE_META[state];
      expect(className).toMatch(/\bborder-/);
      expect(className).toMatch(/\bbg-/);
      expect(className).toMatch(/\btext-/);
    }
  });

  it("uses cautious copy for unknown senders instead of implying verification", () => {
    const { label, tooltip } = TRUST_STATE_META.unknown;
    expect(label).toBe("Unknown");
    expect(tooltip).toMatch(/hasn't been verified/i);
  });

  it("does not claim cryptographic proof for bridged delivery (edge case)", () => {
    const { tooltip } = TRUST_STATE_META.bridged;
    expect(tooltip).toMatch(/can't be fully verified/i);
    expect(tooltip).not.toMatch(/cryptographically verified/i);
  });

  it("only exposes the seven documented trust states (failure guard)", () => {
    expect(Object.keys(TRUST_STATE_META).sort()).toEqual([...ALL_TRUST_STATES].sort());
  });
});
