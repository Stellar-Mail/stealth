import { describe, expect, it } from "vitest";
import { MOBILE_BREAKPOINT, isMobileViewport } from "../../../src/hooks/use-mobile";

describe("mobile-navigation/isMobileViewport", () => {
  it("treats typical phone and tablet widths as mobile (success path)", () => {
    expect(isMobileViewport(320)).toBe(true); // small phone
    expect(isMobileViewport(390)).toBe(true); // modern phone
    expect(isMobileViewport(767)).toBe(true); // largest mobile width
  });

  it("treats tablet-landscape and desktop widths as not mobile", () => {
    expect(isMobileViewport(768)).toBe(false); // md breakpoint -> desktop
    expect(isMobileViewport(1024)).toBe(false);
    expect(isMobileViewport(1440)).toBe(false);
  });

  it("switches exactly at the Tailwind md breakpoint (edge case)", () => {
    // The boundary must align with Tailwind's `md` (min-width: 768px) so the JS
    // layout switch matches the `md:` utilities on the nav surface.
    expect(MOBILE_BREAKPOINT).toBe(768);
    expect(isMobileViewport(MOBILE_BREAKPOINT - 1)).toBe(true);
    expect(isMobileViewport(MOBILE_BREAKPOINT)).toBe(false);
  });

  it("handles degenerate widths without flipping the contract (failure path)", () => {
    expect(isMobileViewport(0)).toBe(true);
    expect(isMobileViewport(-100)).toBe(true);
  });
});
