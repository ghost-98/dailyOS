"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 820;

export function useResponsiveMode() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const syncViewport = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  return { isDesktop: !isMobile, isMobile };
}
