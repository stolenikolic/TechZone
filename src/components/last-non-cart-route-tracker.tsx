"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const COOKIE_KEY = "tz_last_non_cart";
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

export default function LastNonCartRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || pathname === "/mini-cart") return;
    const qs = searchParams.toString();
    const fullPath = qs ? `${pathname}?${qs}` : pathname;
    const encoded = encodeURIComponent(fullPath);
    document.cookie = `${COOKIE_KEY}=${encoded}; path=/; max-age=${COOKIE_TTL_SECONDS}; samesite=lax`;
  }, [pathname, searchParams]);

  return null;
}
