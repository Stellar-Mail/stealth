import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getMotionPreference,
  motionPresets,
  queryPrefersReducedMotion,
} from "../../../src/lib/motion-presets";

type MatchMediaMock = {
  matches: boolean;
  media: string;
};

let matchMediaImpl: MatchMediaMock = { matches: false, media: "" };

function installMatchMedia(matches: boolean) {
  matchMediaImpl = { matches, media: "(prefers-reduced-motion: reduce)" };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      matchMedia: (query: string) =>
        query === "(prefers-reduced-motion: reduce)" ? matchMediaImpl : { matches: false },
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error -- tear down the stubbed window
  delete globalThis.window;
});

describe("queryPrefersReducedMotion", () => {
  it("reports full motion when the OS preference is not set", () => {
    installMatchMedia(false);
    expect(queryPrefersReducedMotion()).toBe(false);
    expect(getMotionPreference()).toBe("full");
  });

  it("reports reduced motion when the OS preference is set", () => {
    installMatchMedia(true);
    expect(queryPrefersReducedMotion()).toBe(true);
    expect(getMotionPreference()).toBe("reduced");
  });

  it("defaults to full motion in non-browser environments", () => {
    expect(queryPrefersReducedMotion()).toBe(false);
  });
});

describe("motion presets under reduced motion", () => {
  it("uses the near-instant reduced config for entrance animations", () => {
    installMatchMedia(true);
    const preset = motionPresets.entrance.slideUp();
    expect(preset.transition).toMatchObject({
      duration: 0.01,
      stiffness: 999,
      damping: 999,
    });
  });

  it("uses the standard config when full motion is preferred", () => {
    installMatchMedia(false);
    const preset = motionPresets.entrance.slideUp();
    expect(preset.transition).toMatchObject({
      duration: 0.3,
      stiffness: 300,
      damping: 30,
    });
  });

  it("drops hover/tap transforms from promote.lift under reduced motion", () => {
    installMatchMedia(true);
    const preset = motionPresets.promote.lift();
    expect(preset.whileHover).toBeUndefined();
    expect(preset.whileTap).toBeUndefined();
  });

  it("drops hover scale from promote.glow under reduced motion", () => {
    installMatchMedia(true);
    const preset = motionPresets.promote.glow();
    expect(preset.whileHover).toBeUndefined();
  });

  it("keeps hover/tap feedback under full motion", () => {
    installMatchMedia(false);
    const lift = motionPresets.promote.lift();
    expect(lift.whileHover).toBeDefined();
    expect(lift.whileTap).toBeDefined();
    const glow = motionPresets.promote.glow();
    expect(glow.whileHover).toBeDefined();
  });

  it("respects reduced motion in remove and confirm presets", () => {
    installMatchMedia(true);
    expect(motionPresets.remove.collapse().transition).toMatchObject({ duration: 0.01 });
    expect(motionPresets.confirm.bounce().transition).toMatchObject({ duration: 0.01 });
    expect(motionPresets.danger.shake().transition).toMatchObject({ duration: 0.012 });
  });
});
