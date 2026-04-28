"use client";

import { MouseEvent, PropsWithChildren, useCallback, useEffect, useState, JSX } from "react";
import { styled } from "@mui/material/styles";

// STYLED COMPONENT
const StyledMenuRoot = styled("div", {
  shouldForwardProp: (prop) => prop !== "open"
})<{ open: boolean }>(({ open, theme }) => ({
  cursor: "pointer",
  position: "relative",
  ".dropdown-icon": {
    transition: "all 250ms ease-in-out",
    transform: `rotate(${open ? (theme.direction === "rtl" ? "-90deg" : "90deg") : "0deg"})`
  },
  ".categories": {
    zIndex: 100,
    position: "relative",
    transformOrigin: "top",
    transition: "all 250ms ease-in-out",
    transform: open ? "scaleY(1)" : "scaleY(0)",
    visibility: open ? "visible" : "hidden",
    opacity: open ? 1 : 0
  }
}));

// ===========================================================
interface Props extends PropsWithChildren {
  render: (handler: (e: MouseEvent<HTMLButtonElement>) => void) => JSX.Element;
}
// ===========================================================

export function CategoryMenu({ render, children }: Props) {
  const [open, setOpen] = useState(false);

  const handleToggleMenu = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("click", handleCloseMenu);
    window.addEventListener("scroll", handleCloseMenu, { passive: true });

    return () => {
      window.removeEventListener("click", handleCloseMenu);
      window.removeEventListener("scroll", handleCloseMenu);
    };
  }, [handleCloseMenu]);

  return (
    <StyledMenuRoot open={open} role="menu">
      {render(handleToggleMenu)}

      <div className="categories" role="menu" aria-label="Category menu" aria-hidden={!open}>
        {children}
      </div>
    </StyledMenuRoot>
  );
}
