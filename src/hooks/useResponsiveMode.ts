"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const MOBILE_BREAKPOINT = 820;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useResponsiveMode() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });
  const [isReady, setIsReady] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const syncViewport = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };

    syncViewport();
    setIsReady(true);
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  return { isDesktop: !isMobile, isMobile, isReady };
}
