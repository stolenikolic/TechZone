import { useEffect, useRef, useState } from "react";

const HIDE_DISTANCE = 150;
const TOP_THRESHOLD = 50;

export function useScrollChromeState(enabled: boolean) {
  const [chromeVisible, setChromeVisible] = useState(true);
  const chromeVisibleRef = useRef(true);
  const accumulated = useRef(0);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const ignoreLayoutShift = useRef(false);

  useEffect(() => {
    if (!enabled) {
      chromeVisibleRef.current = true;
      accumulated.current = 0;
      queueMicrotask(() => setChromeVisible(true));
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    const applyVisibility = (nextVisible: boolean) => {
      if (nextVisible === chromeVisibleRef.current) return;
      chromeVisibleRef.current = nextVisible;
      setChromeVisible(nextVisible);
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        accumulated.current = 0;
        applyVisibility(true);
      }
    };

    motionQuery.addEventListener("change", onMotionChange);

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const currentY = Math.max(0, window.scrollY);
        let delta = currentY - lastScrollY.current;
        lastScrollY.current = currentY;
        ticking.current = false;

        if (ignoreLayoutShift.current) {
          ignoreLayoutShift.current = false;
          if (Math.abs(delta) < HIDE_DISTANCE) delta = 0;
        }

        if (!chromeVisibleRef.current && currentY <= TOP_THRESHOLD) {
          accumulated.current = 0;
          applyVisibility(true);
          return;
        }

        if (chromeVisibleRef.current) {
          accumulated.current = Math.max(0, accumulated.current + delta);
          if (accumulated.current >= HIDE_DISTANCE) {
            accumulated.current = 0;
            ignoreLayoutShift.current = true;
            applyVisibility(false);
          }
          return;
        }

        accumulated.current = Math.min(0, accumulated.current + delta);
        if (accumulated.current <= -HIDE_DISTANCE) {
          accumulated.current = 0;
          ignoreLayoutShift.current = true;
          applyVisibility(true);
        }
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
