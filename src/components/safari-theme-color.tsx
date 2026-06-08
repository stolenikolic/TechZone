"use client";

import { useEffect } from "react";

const TOPBAR_COLOR = "#1F2937";
const HEADER_COLOR = "#ffffff";
const SCROLL_SWITCH_PX = 36;

function setThemeColor(color: string) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", color);
}

export default function SafariThemeColor() {
  useEffect(() => {
    const update = () => {
      setThemeColor(window.scrollY < SCROLL_SWITCH_PX ? TOPBAR_COLOR : HEADER_COLOR);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return null;
}
