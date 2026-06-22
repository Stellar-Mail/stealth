import * as React from "react";

export const MOBILE_BREAKPOINT = 768;

/**
 * Pure breakpoint predicate shared by the hook and its tests. A viewport counts
 * as "mobile" when its width is below the `md` breakpoint (768px), which keeps
 * this in lockstep with the Tailwind `md:` utilities used across the navigation
 * surface (e.g. the bottom bar's `md:hidden` and the sidebar's `hidden md:flex`).
 */
export function isMobileViewport(width: number): boolean {
  return width < MOBILE_BREAKPOINT;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(isMobileViewport(window.innerWidth));
    };
    mql.addEventListener("change", onChange);
    setIsMobile(isMobileViewport(window.innerWidth));
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
