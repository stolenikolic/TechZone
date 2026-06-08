import { useEffect, useRef, useState } from "react";

const SCROLL_THRESHOLD = 24;
const TOP_THRESHOLD = 50;
const TOGGLE_COOLDOWN_MS = 180;

export function useScrollChromeState(enabled: boolean) {
  const [chromeVisible, setChromeVisible] = useState(true);
  const chromeVisibleRef = useRef(true);
  const lastScrollY = useRef(0);
  const lastToggleAt = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (!enabled) {
      chromeVisibleRef.current = true;
      queueMicrotask(() => setChromeVisible(true));
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    const applyVisibility = (nextVisible: boolean, force = false) => {
      if (nextVisible === chromeVisibleRef.current) return;

      const now = Date.now();
      if (!force && now - lastToggleAt.current < TOGGLE_COOLDOWN_MS) return;

      chromeVisibleRef.current = nextVisible;
      lastToggleAt.current = now;
      setChromeVisible(nextVisible);
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) applyVisibility(true, true);
    };

    motionQuery.addEventListener("change", onMotionChange);

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;
        let nextVisible = chromeVisibleRef.current;

        if (currentY <= TOP_THRESHOLD) {
          nextVisible = true;
        } else if (delta > SCROLL_THRESHOLD) {
          nextVisible = false;
        } else if (delta < -SCROLL_THRESHOLD) {
          nextVisible = true;
        }

        applyVisibility(nextVisible, currentY <= TOP_THRESHOLD);

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
