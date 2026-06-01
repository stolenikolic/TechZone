/** Modal / intercept routes — keep background scroll position. */
export function isModalPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/mini-cart") return true;
  return /^\/products\/[^/]+\/view\/?$/.test(pathname);
}

export function forceScrollToTop() {
  if (typeof window === "undefined") return;

  const scrollOpts: ScrollToOptions = { top: 0, left: 0, behavior: "auto" };

  try {
    window.scrollTo(scrollOpts);
  } catch {
    window.scrollTo(0, 0);
  }

  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/** Run scroll now and again after paint / Next.js scroll handling. */
export function forceScrollToTopWithRetries() {
  forceScrollToTop();

  requestAnimationFrame(() => {
    forceScrollToTop();
    requestAnimationFrame(forceScrollToTop);
  });

  window.setTimeout(forceScrollToTop, 0);
  window.setTimeout(forceScrollToTop, 50);
  window.setTimeout(forceScrollToTop, 150);
}
