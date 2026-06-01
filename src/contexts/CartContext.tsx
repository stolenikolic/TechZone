"use client";

import {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";
import { useAuth } from "contexts/AuthContext";
import {
  loadUserCartFromBrowser,
  mergeGuestCartFromBrowser,
  syncUserCartFromBrowser
} from "lib/cart/cart-client";

// =================================================================================
type InitialState = { cart: CartItem[]; warning: string | null };
export const CART_STORAGE_KEY = "techzone_guest_cart_v1";

const CART_SYNC_DEBOUNCE_MS = 600;

export interface CartItem {
  id: string;
  qty: number;
  title: string;
  slug: string;
  price: number;
  thumbnail: string;
}

interface CartActionType {
  payload?: CartItem;
  payloadList?: { id: string; price: number }[];
  unavailableIds?: string[];
  cart?: CartItem[];
  /**
   * Kad je true (dodavanje s PDP/liste): postojeća stavka → qty += payload.qty.
   * Kad je false/undefined (korpa, mini-korpa): qty = apsolutna vrijednost iz payloada.
   */
  addToExisting?: boolean;
  type:
    | "CHANGE_CART_AMOUNT"
    | "CLEAR_CART"
    | "SYNC_CART_PRICES"
    | "REMOVE_UNAVAILABLE_ITEMS"
    | "CLEAR_CART_WARNING"
    | "HYDRATE_CART";
}

// =================================================================================
const INITIAL_STATE: InitialState = { cart: [], warning: null };

// ==============================================================
interface ContextProps {
  state: InitialState;
  dispatch: (args: CartActionType) => void;
  isHydrated: boolean;
}
// ==============================================================

export const CartContext = createContext<ContextProps>({} as ContextProps);

function sanitizeCart(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (
        typeof row.id !== "string" ||
        typeof row.slug !== "string" ||
        typeof row.title !== "string" ||
        typeof row.thumbnail !== "string" ||
        typeof row.price !== "number" ||
        !Number.isFinite(row.price) ||
        typeof row.qty !== "number" ||
        !Number.isFinite(row.qty)
      ) {
        return null;
      }
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        thumbnail: row.thumbnail,
        price: row.price,
        qty: Math.max(1, Math.floor(row.qty))
      } as CartItem;
    })
    .filter((item): item is CartItem => item != null);
}

function readGuestCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeCart(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeGuestCart(cart: CartItem[]) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Ignore storage errors.
  }
}

function clearGuestCart() {
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

const reducer = (state: InitialState, action: CartActionType) => {
  switch (action.type) {
    case "HYDRATE_CART": {
      const hydrated = sanitizeCart(action.cart);
      return { ...state, cart: hydrated };
    }
    case "CHANGE_CART_AMOUNT": {
      const cartList = state.cart;
      const cartItem = action.payload;

      if (cartItem === undefined) return state;

      const existIndex = cartList.findIndex((item) => item.id === cartItem.id);

      if (cartItem.qty < 1) {
        const updatedCart = cartList.filter((item) => item.id !== cartItem.id);
        return { ...state, cart: updatedCart };
      }

      if (existIndex > -1) {
        const updatedCart = [...cartList];
        const existing = updatedCart[existIndex];
        const mergedQty = action.addToExisting ? existing.qty + cartItem.qty : cartItem.qty;
        const nextQty = Math.max(1, Math.floor(mergedQty));
        updatedCart[existIndex] = {
          ...existing,
          qty: nextQty,
          price: cartItem.price,
          title: cartItem.title,
          slug: cartItem.slug,
          thumbnail: cartItem.thumbnail
        };
        return { ...state, cart: updatedCart, warning: null };
      }

      return { ...state, cart: [...cartList, cartItem], warning: null };
    }
    case "CLEAR_CART":
      return { ...state, cart: [], warning: null };
    case "SYNC_CART_PRICES": {
      const payloadList = action.payloadList ?? [];
      if (payloadList.length === 0 || state.cart.length === 0) return state;
      const priceById = new Map(payloadList.map((item) => [item.id, item.price]));
      let changed = false;
      const updatedCart = state.cart.map((item) => {
        const latest = priceById.get(item.id);
        if (latest == null || latest === item.price) return item;
        changed = true;
        return { ...item, price: latest };
      });
      if (!changed) return state;
      return { ...state, cart: updatedCart };
    }
    case "REMOVE_UNAVAILABLE_ITEMS": {
      const unavailableIds = action.unavailableIds ?? [];
      if (unavailableIds.length === 0 || state.cart.length === 0) return state;
      const unavailableSet = new Set(unavailableIds);
      const existingCount = state.cart.length;
      const updatedCart = state.cart.filter((item) => !unavailableSet.has(item.id));
      const removedCount = existingCount - updatedCart.length;
      if (removedCount <= 0) return state;
      const noun = removedCount === 1 ? "item" : "items";
      return {
        ...state,
        cart: updatedCart,
        warning: `${removedCount} ${noun} removed from cart because no longer available.`
      };
    }
    case "CLEAR_CART_WARNING": {
      if (state.warning == null) return state;
      return { ...state, warning: null };
    }

    default: {
      return state;
    }
  }
};

export default function CartProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const mergeStartedRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);
  const skipNextSyncRef = useRef(false);
  const serverCartLoadedRef = useRef(false);

  const cartSyncKey = useMemo(
    () => state.cart.map((item) => `${item.id}:${item.qty}`).join("|"),
    [state.cart]
  );
  const cartIds = useMemo(() => state.cart.map((item) => item.id), [state.cart]);

  const hydrateGuest = useCallback(() => {
    skipNextSyncRef.current = true;
    dispatch({ type: "HYDRATE_CART", cart: readGuestCart() });
    setIsHydrated(true);
  }, []);

  const hydrateAuthenticated = useCallback(async () => {
    serverCartLoadedRef.current = false;
    skipNextSyncRef.current = true;
    try {
      const items = await loadUserCartFromBrowser();
      dispatch({ type: "HYDRATE_CART", cart: items });
      serverCartLoadedRef.current = true;
    } catch {
      serverCartLoadedRef.current = false;
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      mergeStartedRef.current = false;
      prevUserIdRef.current = null;
      serverCartLoadedRef.current = false;
      hydrateGuest();
      return;
    }

    const isFreshLogin = prevUserIdRef.current == null;
    prevUserIdRef.current = user.id;

    let cancelled = false;

    const run = async () => {
      if (isFreshLogin && !mergeStartedRef.current) {
        mergeStartedRef.current = true;
        const guestCart = readGuestCart();
        if (guestCart.length > 0) {
          try {
            await mergeGuestCartFromBrowser(
              guestCart.map((item) => ({ id: item.id, qty: item.qty }))
            );
            clearGuestCart();
          } catch {
            // Keep guest cart if merge fails; server cart still loads below.
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
    writeGuestCart(state.cart);
  }, [isHydrated, user, state.cart]);

  useEffect(() => {
    if (!isHydrated || !user || authLoading) return;
    if (!serverCartLoadedRef.current) return;

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      void syncUserCartFromBrowser(
        state.cart.map((item) => ({ id: item.id, qty: item.qty }))
      ).catch(() => {
        // Keep local state; next change retries sync.
      });
    }, CART_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [isHydrated, user, authLoading, cartSyncKey, state.cart]);

  useEffect(() => {
    if (cartIds.length === 0) return;
    const controller = new AbortController();

    const syncPrices = async () => {
      try {
        const response = await fetch("/api/cart/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: cartIds }),
          signal: controller.signal
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          prices?: { id: string; price: number }[];
          unavailableIds?: string[];
        };
        if (!Array.isArray(data.prices)) return;
        dispatch({ type: "SYNC_CART_PRICES", payloadList: data.prices });
        if (Array.isArray(data.unavailableIds) && data.unavailableIds.length > 0) {
          dispatch({ type: "REMOVE_UNAVAILABLE_ITEMS", unavailableIds: data.unavailableIds });
        }
      } catch {
        // No-op: cart should keep current values if sync fails.
      }
    };

    void syncPrices();
    return () => controller.abort();
  }, [cartIds, cartSyncKey]);

  useEffect(() => {
    if (state.warning == null) return;
    const timer = setTimeout(() => {
      dispatch({ type: "CLEAR_CART_WARNING" });
    }, 7000);
    return () => clearTimeout(timer);
  }, [state.warning]);

  const contextValue = useMemo(
    () => ({ state, dispatch, isHydrated }),
    [state, dispatch, isHydrated]
  );

  return <CartContext value={contextValue}>{children}</CartContext>;
}
