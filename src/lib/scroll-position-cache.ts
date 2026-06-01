const STORAGE_KEY = "tz_scroll_positions_v1";

function routeKey(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}

function readCache(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, number>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function saveScrollPosition(pathname: string, search: string) {
  if (typeof window === "undefined" || !pathname) return;

  const y = Math.max(0, Math.floor(window.scrollY));
  const cache = readCache();
  cache[routeKey(pathname, search)] = y;
  writeCache(cache);
}

export function restoreScrollPosition(pathname: string, search: string) {
  if (typeof window === "undefined" || !pathname) return;

  const key = routeKey(pathname, search);
  const cached = readCache()[key];
  if (typeof cached !== "number" || !Number.isFinite(cached) || cached < 0) return;

  const y = Math.floor(cached);

  const apply = () => {
    window.scrollTo({ top: y, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = y;
    document.body.scrollTop = y;
  };

  apply();
  requestAnimationFrame(apply);
  window.setTimeout(apply, 0);
  window.setTimeout(apply, 50);
}
