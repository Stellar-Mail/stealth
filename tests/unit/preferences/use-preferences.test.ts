import { describe, expect, it } from "vitest";
import {
  resolveStoredPreferences,
  resolveMotion,
} from "../../../src/features/preferences/usePreferences";
import { defaultPreferences } from "../../../src/features/preferences/types";

describe("preferences/resolveMotion", () => {
  it("keeps full motion when neither the toggle nor the OS asks to reduce (success path)", () => {
    expect(resolveMotion(false, false)).toBe("full");
  });

  it("reduces motion when the in-app toggle is on", () => {
    expect(resolveMotion(true, false)).toBe("lower");
  });

  it("honors the OS reduced-motion setting even when the toggle is off (a11y fallback)", () => {
    expect(resolveMotion(false, true)).toBe("lower");
  });

  it("reduces motion when both ask for it", () => {
    expect(resolveMotion(true, true)).toBe("lower");
  });
});

describe("preferences/resolveStoredPreferences", () => {
  it("merges a stored value over the current defaults (success path)", () => {
    const stored = JSON.stringify({ theme: "light", sound: true });
    const { preferences, corrupt } = resolveStoredPreferences(stored, null);

    expect(corrupt).toBe(false);
    expect(preferences.theme).toBe("light");
    expect(preferences.sound).toBe(true);
    // Untouched keys fall back to defaults, keeping shape stable across versions.
    expect(preferences.density).toBe(defaultPreferences.density);
    expect(preferences.receipts).toEqual(defaultPreferences.receipts);
  });

  it("returns defaults when nothing is stored", () => {
    const { preferences, corrupt } = resolveStoredPreferences(null, null);
    expect(corrupt).toBe(false);
    expect(preferences).toEqual(defaultPreferences);
  });

  it("migrates the legacy key only when the current key is absent (edge case)", () => {
    const legacy = JSON.stringify({ theme: "light" });
    const { preferences, corrupt } = resolveStoredPreferences(null, legacy);
    expect(corrupt).toBe(false);
    expect(preferences.theme).toBe("light");
  });

  it("prefers the current key over the legacy key when both exist", () => {
    const current = JSON.stringify({ theme: "dark" });
    const legacy = JSON.stringify({ theme: "light" });
    const { preferences } = resolveStoredPreferences(current, legacy);
    expect(preferences.theme).toBe("dark");
  });

  it("flags a corrupt current key for cleanup and falls back to defaults (failure path)", () => {
    const { preferences, corrupt } = resolveStoredPreferences("{not valid json", null);
    expect(corrupt).toBe(true);
    expect(preferences).toEqual(defaultPreferences);
  });

  it("ignores a corrupt legacy key without flagging cleanup", () => {
    const { preferences, corrupt } = resolveStoredPreferences(null, "{bad");
    expect(corrupt).toBe(false);
    expect(preferences).toEqual(defaultPreferences);
  });
});
