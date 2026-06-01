"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  markPendingHistoryTraversal,
  consumePendingHistoryTraversal
} from "lib/navigation-scroll-state";
import {
  forceScrollToTopWithRetries,
  isModalPath
} from "lib/scroll-to-top";
import { restoreScrollPosition, saveScrollPosition } from "lib/scroll-position-cache";

type RouteSnapshot = { pathname: string; search: string };

/**
 * Forward navigations: scroll to top.
 * Back/forward: restore cached scroll for the destination route.
 */
export default function ScrollToTopOnNavigate() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const previousRouteRef = useRef<RouteSnapshot>({ pathname: "", search: "" });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "auto";
    }

    const onPopState = () => {
      markPendingHistoryTraversal();
    };
    window.addEventListener("popstate", onPopState);

    const navigation = window.navigation;
    const onNavigate = (event: Event) => {
      const navigationType = (event as Event & { navigationType?: string }).navigationType;
      if (navigationType === "traverse") {
        markPendingHistoryTraversal();
      }
    };
    navigation?.addEventListener("navigate", onNavigate);

    return () => {
      window.removeEventListener("popstate", onPopState);
      navigation?.removeEventListener("navigate", onNavigate);
    };
  }, []);

  useLayoutEffect(() => {
    const previous = previousRouteRef.current;
    const routeChanged = previous.pathname !== pathname || previous.search !== search;

    // Save scroll when leaving a real page (not when closing a modal overlay).
    if (previous.pathname && routeChanged && !isModalPath(previous.pathname)) {
      saveScrollPosition(previous.pathname, previous.search);
    }

    if (routeChanged && !isModalPath(pathname)) {
      const returnedFromModal = isModalPath(previous.pathname);

      if (consumePendingHistoryTraversal()) {
        // Modals (cart, login, quick view) do not move the page behind — skip restore.
        if (!returnedFromModal) {
          restoreScrollPosition(pathname, search);
        }
      } else if (previous.pathname && !returnedFromModal) {
        forceScrollToTopWithRetries();
      }
    }

    previousRouteRef.current = { pathname, search };
  }, [pathname, search]);

  return null;
}
