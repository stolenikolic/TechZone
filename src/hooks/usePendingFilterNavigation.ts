"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseFilterUrlSnapshot,
  toFilterUrlSnapshot
} from "lib/shop/filter-url-snapshot";

/**
 * Pending URL + spinner ključevi za filtere (brzi uzastopni klikovi, optimistički checkbox).
 */
export default function usePendingFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [pendingSnapshot, setPendingSnapshot] = useState<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const [pendingFilterKeys, setPendingFilterKeys] = useState<Set<string>>(() => new Set());
  const pendingFilterKeysRef = useRef<Set<string>>(new Set());
  const urlSnapshotRef = useRef("");

  const getActualSnapshot = useCallback(() => {
    return toFilterUrlSnapshot(pathname, searchParams);
  }, [pathname, searchParams]);

  const getEffectiveSnapshot = useCallback(() => {
    return pendingSnapshot ?? getActualSnapshot();
  }, [pendingSnapshot, getActualSnapshot]);

  const getEffectiveParams = useCallback((): URLSearchParams => {
    return parseFilterUrlSnapshot(getEffectiveSnapshot()).params;
  }, [getEffectiveSnapshot]);

  const getEffectivePathname = useCallback((): string => {
    return parseFilterUrlSnapshot(getEffectiveSnapshot()).pathname;
  }, [getEffectiveSnapshot]);

  const pushUrlAndRefresh = useCallback(
    (url: string, filterKeys: string | string[]) => {
      const keys = Array.isArray(filterKeys) ? filterKeys : [filterKeys];
      pendingUrlRef.current = url;
      setPendingSnapshot(url);
      keys.forEach((k) => pendingFilterKeysRef.current.add(k));
      setPendingFilterKeys(new Set(pendingFilterKeysRef.current));
      router.push(url, { scroll: false });
      setTimeout(() => router.refresh(), 0);
    },
    [router]
  );

  const isFilterPending = useCallback(
    (key: string) => pendingFilterKeys.has(key),
    [pendingFilterKeys]
  );

  /** Spinner na naslovu sekcije (npr. "Brand") dok bilo koji pod-filter te sekcije čeka. */
  const isSectionPending = useCallback(
    (slug: string) => {
      if (pendingFilterKeys.has(slug)) return true;
      for (const key of Array.from(pendingFilterKeys)) {
        if (key.startsWith(`${slug}:`)) return true;
      }
      return false;
    },
    [pendingFilterKeys]
  );

  const filterValuePendingKey = useCallback((slug: string, value: string) => `${slug}:${value}`, []);

  useEffect(() => {
    const actual = getActualSnapshot();
    if (!pendingSnapshot) {
      urlSnapshotRef.current = actual;
      pendingUrlRef.current = actual;
      return;
    }
    if (actual !== pendingSnapshot) return;

    urlSnapshotRef.current = actual;
    pendingUrlRef.current = actual;
    const timer = window.setTimeout(() => {
      pendingFilterKeysRef.current = new Set();
      setPendingFilterKeys(new Set());
      setPendingSnapshot(null);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams, pendingSnapshot, getActualSnapshot]);

  return {
    pendingSnapshot,
    getActualSnapshot,
    getEffectiveSnapshot,
    getEffectiveParams,
    getEffectivePathname,
    pushUrlAndRefresh,
    isFilterPending,
    isSectionPending,
    filterValuePendingKey,
    /** Kompatibilnost: zadnji / jedini ključ za legacy pozive. */
    pendingFilterKey:
      pendingFilterKeys.size > 0 ? Array.from(pendingFilterKeys)[pendingFilterKeys.size - 1] : null
  };
}
