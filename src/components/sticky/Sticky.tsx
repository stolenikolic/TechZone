"use client";

import { useCallback, useEffect, useRef, useState, PropsWithChildren } from "react";
import clsx from "clsx";
// STYLED COMPONENT
import { StyledRoot } from "./styles";

// ============================================================
interface Props extends PropsWithChildren {
  fixedOn: number;
  scrollDistance?: number;
  onSticky?: (isFixed: boolean) => void;
}

// ============================================================

export default function Sticky({ fixedOn, children, onSticky, scrollDistance = 0 }: Props) {
  const [height, setHeight] = useState(0);
  const [fixed, setFixed] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const scrollListener = useCallback(() => {
    const isFixed = window.scrollY >= fixedOn + scrollDistance;
    if (isFixed !== fixed) setFixed(isFixed);
  }, [fixed, fixedOn, scrollDistance]);

  useEffect(() => {
    const handleScrollAndResize = scrollListener;

    window.addEventListener("scroll", handleScrollAndResize);
    window.addEventListener("resize", handleScrollAndResize);

    return () => {
      window.removeEventListener("scroll", handleScrollAndResize);
      window.removeEventListener("resize", handleScrollAndResize);
    };
  }, [scrollListener]);

  useEffect(() => {
    if (onSticky) onSticky(fixed);
  }, [fixed, onSticky]);

  useEffect(() => {
    if (elementRef.current) {
      setHeight(elementRef.current.offsetHeight);
      scrollListener();
    }
  }, [scrollListener]);

  return (
    <StyledRoot fixedOn={fixedOn} componentHeight={height} fixed={fixed}>
      <div ref={elementRef} className={clsx({ hold: !fixed, fixed: fixed })}>
        {children}
      </div>
    </StyledRoot>
  );
}
