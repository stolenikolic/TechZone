"use client";

import { useCallback, useEffect, useRef, useState, PropsWithChildren } from "react";
import clsx from "clsx";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useScrollChromeVisible } from "contexts/ScrollChromeContext";
import { layoutConstant } from "utils/constants";
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
  const theme = useTheme();
  const isMobileLayout = useMediaQuery(theme.breakpoints.down("lg"), { noSsr: true });
  const effectiveScrollDistance = isMobileLayout
    ? layoutConstant.topbarHeight
    : scrollDistance;
  const [height, setHeight] = useState(0);
  const [fixed, setFixed] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const chromeVisible = useScrollChromeVisible();

  const scrollListener = useCallback(() => {
    const isFixed = window.scrollY >= fixedOn + effectiveScrollDistance;
    if (isFixed !== fixed) setFixed(isFixed);
  }, [fixed, fixedOn, effectiveScrollDistance]);

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
    <StyledRoot
      fixedOn={fixedOn}
      componentHeight={height}
      fixed={fixed}
      chromeHidden={fixed && !chromeVisible}
    >
      <div ref={elementRef} className={clsx({ hold: !fixed, fixed: fixed })}>
        {children}
      </div>
    </StyledRoot>
  );
}
