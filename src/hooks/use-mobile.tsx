import { useEffect, useState } from 'react';

export function useMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mqlMobile = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mqlMobile.matches);
    
    const mqlMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mqlMotion.matches);

    const handleMobileChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);

    mqlMobile.addEventListener('change', handleMobileChange);
    mqlMotion.addEventListener('change', handleMotionChange);

    return () => {
      mqlMobile.removeEventListener('change', handleMobileChange);
      mqlMotion.removeEventListener('change', handleMotionChange);
    };
  }, [breakpoint]);

  return { isMobile, prefersReducedMotion };
}
