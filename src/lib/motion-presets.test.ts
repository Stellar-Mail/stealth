import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { motionPresets, getMotionPreference, isReducedMotion } from "./motion-presets";

describe("motionPresets reduced motion compliance", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function setReducedMotion(matches: boolean) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion: reduce") ? matches : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  describe("getMotionPreference & isReducedMotion", () => {
    it("returns full when prefers-reduced-motion is false", () => {
      setReducedMotion(false);
      expect(isReducedMotion()).toBe(false);
      expect(getMotionPreference()).toBe("full");
    });

    it("returns reduced when prefers-reduced-motion is true", () => {
      setReducedMotion(true);
      expect(isReducedMotion()).toBe(true);
      expect(getMotionPreference()).toBe("reduced");
    });
  });

  describe("Entrance Presets", () => {
    it("returns spring configuration when motion is full", () => {
      setReducedMotion(false);
      const preset = motionPresets.entrance.slideUp();
      expect(preset.initial).toEqual({ opacity: 0, y: 16 });
      expect(preset.transition.type).toBe("spring");
      expect(preset.transition.duration).toBe(0.3);
    });

    it("returns simplified configuration when motion is reduced", () => {
      setReducedMotion(true);
      const preset = motionPresets.entrance.slideUp();
      expect(preset.initial).toEqual({ opacity: 0 });
      expect(preset.transition.duration).toBe(0.01);
    });
  });

  describe("Promote Presets", () => {
    it("includes hover/tap effects when motion is full", () => {
      setReducedMotion(false);
      const preset = motionPresets.promote.scale();
      expect(preset.whileHover).toEqual({ scale: 1.02 });
      expect(preset.whileTap).toBeDefined();
    });

    it("disables hover/tap effects when motion is reduced", () => {
      setReducedMotion(true);
      const preset = motionPresets.promote.scale();
      expect(preset.whileHover).toBeUndefined();
      expect(preset.whileTap).toBeUndefined();
    });
  });

  describe("Danger Presets", () => {
    it("oscillates keyframes when motion is full", () => {
      setReducedMotion(false);
      const preset = motionPresets.danger.shake();
      expect(preset.animate).toEqual({ x: [0, -6, 6, -6, 0] });
    });

    it("suppresses keyframe oscillations when motion is reduced", () => {
      setReducedMotion(true);
      const preset = motionPresets.danger.shake();
      expect(preset.animate).toEqual({ x: 0 });
    });
  });
});
