import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECEIPT_STATE,
  RECEIPT_STATES,
  RECEIPT_STATE_OPTIONS,
  getReceiptStateOption,
} from "../constants/receiptStates";

describe("receipt state controls", () => {
  it("defines the five supported receipt states", () => {
    expect(RECEIPT_STATES).toEqual(["disabled", "requested", "delivered", "read", "failed"]);
    expect(Object.keys(RECEIPT_STATE_OPTIONS).sort()).toEqual([...RECEIPT_STATES].sort());
  });

  it("provides a label, description, and example for every state", () => {
    for (const state of RECEIPT_STATES) {
      const option = getReceiptStateOption(state);
      expect(option.state).toBe(state);
      expect(option.label.trim().length).toBeGreaterThan(0);
      expect(option.description.trim().length).toBeGreaterThan(0);
      expect(option.example.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses a valid default receipt state", () => {
    expect(RECEIPT_STATES).toContain(DEFAULT_RECEIPT_STATE);
    expect(getReceiptStateOption(DEFAULT_RECEIPT_STATE).state).toBe(DEFAULT_RECEIPT_STATE);
  });
});
