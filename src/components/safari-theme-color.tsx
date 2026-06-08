"use client";

import { useEffect } from "react";

/**
 * iOS 15–18: transparent theme-color enables blurred content behind the URL bar.
 * iOS 26+: ignored — Safari samples fixed-element background-color instead (see header styles).
 */
const THEME_TRANSPARENT = "#ffffff00";

function setThemeColor(color: string) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", color);
  });
}

export default function SafariThemeColor() {
  useEffect(() => {
    setThemeColor(THEME_TRANSPARENT);
  }, []);

  return null;
}
