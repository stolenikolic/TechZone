import { RefObject, useCallback, useEffect, useState } from "react";

export default function useScroller(ref: RefObject<HTMLElement | null>) {
  const [isFixedHeader, setIsFixedHeader] = useState(false);

  const scroller = useCallback(() => {
    let positionHeight = 0;

    if (ref.current) {
      positionHeight = ref.current.offsetTop + ref.current.offsetHeight;
    }

    if (positionHeight && window.scrollY > positionHeight) {
      setIsFixedHeader(true);
      return;
    }

    setIsFixedHeader(false);
  }, [ref]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    queueMicrotask(scroller);

    window.addEventListener("scroll", scroller);
    return () => window.removeEventListener("scroll", scroller);
  }, [scroller]);

  return { isFixedHeader };
}
