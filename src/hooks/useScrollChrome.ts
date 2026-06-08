import { useEffect, useRef, useState } from "react";

const SCROLL_THRESHOLD = 10;
const TOP_THRESHOLD = 50;

export function useScrollChromeState(enabled: boolean) {
  const [chromeVisible, setChromeVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => setChromeVisible(true));
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    const onMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) setChromeVisible(true);
    };

    motionQuery.addEventListener("change", onMotionChange);

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;

        if (currentY <= TOP_THRESHOLD) {
          setChromeVisible(true);
        } else if (delta > SCROLL_THRESHOLD) {
          setChromeVisible(false);
        } else if (delta < -SCROLL_THRESHOLD) {
          setChromeVisible(true);
        }

        lastScrollY.current = Math.max(0, currentY);
        ticking.current = false;
      });
    };

    lastScrollY.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, [enabled]);

  return chromeVisible;
}
