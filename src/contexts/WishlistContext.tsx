"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import { useAuth } from "contexts/AuthContext";

export const WISHLIST_STORAGE_KEY = "techzone_guest_wishlist_v1";

type WishlistContextValue = {
  productIds: string[];
  count: number;
  isLoading: boolean;
  isHydrated: boolean;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

function sanitizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0))
  );
}

function readGuestIds(): string[] {
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeGuestIds(ids: string[]) {
  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors.
  }
}

function clearGuestIds() {
  try {
    window.localStorage.removeItem(WISHLIST_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function WishlistProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const [productIds, setProductIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const mergeStartedRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  const fetchServerIds = useCallback(async () => {
    const response = await fetch("/api/wishlist/ids");
    if (!response.ok) throw new Error("Failed to load wishlist");
    const data = (await response.json()) as { ids?: string[] };
    return sanitizeIds(data.ids);
  }, []);

  const hydrateGuest = useCallback(() => {
    setProductIds(readGuestIds());
    setIsHydrated(true);
  }, []);

  const hydrateAuthenticated = useCallback(async () => {
    setIsLoading(true);
    try {
      const ids = await fetchServerIds();
      setProductIds(ids);
    } catch {
      setProductIds([]);
    } finally {
      setIsLoading(false);
      setIsHydrated(true);
    }
  }, [fetchServerIds]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      mergeStartedRef.current = false;
      prevUserIdRef.current = null;
      hydrateGuest();
      return;
    }

    const isFreshLogin = prevUserIdRef.current == null;
    prevUserIdRef.current = user.id;

    let cancelled = false;

    const run = async () => {
      if (isFreshLogin && !mergeStartedRef.current) {
        mergeStartedRef.current = true;
        const guestIds = readGuestIds();
        if (guestIds.length > 0) {
          setIsLoading(true);
          try {
            await fetch("/api/wishlist/merge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productIds: guestIds })
            });
            clearGuestIds();
          } catch {
            // Keep guest IDs if merge fails; server list still loads below.
          }
        }
      }

      if (cancelled) return;
      await hydrateAuthenticated();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, hydrateGuest, hydrateAuthenticated]);

  useEffect(() => {
    if (!isHydrated || user) return;
    writeGuestIds(productIds);
  }, [isHydrated, user, productIds]);

  const isInWishlist = useCallback(
    (productId: string) => productIds.includes(productId),
    [productIds]
  );

  const removeFromWishlistItem = useCallback(
    async (productId: string) => {
      const previous = productIds;
      setProductIds((ids) => ids.filter((id) => id !== productId));

      if (!user) return;

      try {
        const response = await fetch(`/api/wishlist/${encodeURIComponent(productId)}`, {
          method: "DELETE"
        });
        if (!response.ok) throw new Error("Failed to remove");
      } catch {
        setProductIds(previous);
      }
    },
    [productIds, user]
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (isInWishlist(productId)) {
        await removeFromWishlistItem(productId);
        return;
      }

      const previous = productIds;
      setProductIds((ids) => [productId, ...ids.filter((id) => id !== productId)]);

      if (!user) return;

      try {
        const response = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId })
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Failed to add");
        }
      } catch {
        setProductIds(previous);
      }
    },
    [isInWishlist, productIds, removeFromWishlistItem, user]
  );

  const value = useMemo(
    () => ({
      productIds,
      count: productIds.length,
      isLoading,
      isHydrated,
      isInWishlist,
      toggleWishlist,
      removeFromWishlist: removeFromWishlistItem
    }),
    [productIds, isLoading, isHydrated, isInWishlist, toggleWishlist, removeFromWishlistItem]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlistContext() {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error("useWishlist must be used within WishlistProvider");
  }
  return ctx;
}
