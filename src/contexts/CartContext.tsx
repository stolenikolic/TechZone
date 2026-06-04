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
  clearUserCartFromBrowser,
  loadUserCartFromBrowser,
  mergeGuestCartFromBrowser,
  syncUserCartFromBrowser
} from "lib/cart/cart-client";
import {
  clearGuestCart,
  guestStorageHasItems,
  GUEST_CART_STORAGE_KEY,
  readGuestCart,
  writeGuestCart
} from "lib/cart/guest-cart-storage";
import { sanitizeCart } from "lib/cart/sanitize-cart";
import type { OfferChoiceKey } from "lib/product-offers";

// =================================================================================
type InitialState = { cart: CartItem[]; warning: string | null };
/** @deprecated Use GUEST_CART_STORAGE_KEY from lib/cart/guest-cart-storage */
export const CART_STORAGE_KEY = GUEST_CART_STORAGE_KEY;

const CART_SYNC_DEBOUNCE_MS = 600;
const CART_PRICE_SYNC_DEBOUNCE_MS = 4000;

export interface CartItem {
  /** Composite line id: `${productId}:${supplierProductId}` */
  id: string;
  productId: string;
  supplierProductId: string;
  offerChoice: OfferChoiceKey;
  deliveryLabel?: string;
  /** ISO date for delivery estimate (used for cart summary). */
  estimatedDeliveryDate?: string;
  originalPrice?: number;
  qty: number;
  title: string;
  slug: string;
  price: number;
  thumbnail: string;
}

interface CartActionType {
  payload?: CartItem;
  payloadList?: {
    id: string;
    price: number;
    originalPrice?: number;
    estimatedDeliveryDate?: string;
    deliveryLabel?: string;
  }[];
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

function mergeCartLine(existing: CartItem, incoming: CartItem, addToExisting: boolean): CartItem {
  const mergedQty = addToExisting ? existing.qty + incoming.qty : incoming.qty;
  return {
    ...existing,
    ...incoming,
    qty: Math.max(1, Math.floor(mergedQty))
  };
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
        updatedCart[existIndex] = mergeCartLine(
          updatedCart[existIndex],
          cartItem,
          Boolean(action.addToExisting)
        );
        return { ...state, cart: updatedCart, warning: null };
      }

      return { ...state, cart: [...cartList, cartItem], warning: null };
    }
    case "CLEAR_CART":
      return { ...state, cart: [], warning: null };
    case "SYNC_CART_PRICES": {
      const payloadList = action.payloadList ?? [];
      if (payloadList.length === 0 || state.cart.length === 0) return state;
      const priceById = new Map(payloadList.map((item) => [item.id, item]));
      let changed = false;
      const updatedCart = state.cart.map((item) => {
        const latest = priceById.get(item.id);
        if (latest == null) return item;

        const nextPrice = latest.price;
        const nextOriginal = latest.originalPrice;
        const nextDeliveryDate = latest.estimatedDeliveryDate?.trim();
        const nextDeliveryLabel = latest.deliveryLabel?.trim();

        if (
          nextPrice === item.price &&
          (nextOriginal == null || nextOriginal === item.originalPrice) &&
          (nextDeliveryDate == null || nextDeliveryDate === item.estimatedDeliveryDate) &&
          (nextDeliveryLabel == null || nextDeliveryLabel === item.deliveryLabel)
        ) {
          return item;
        }

        changed = true;
        return {
          ...item,
          price: nextPrice,
          ...(nextOriginal != null && nextOriginal > 0 ? { originalPrice: nextOriginal } : {}),
          ...(nextDeliveryDate
            ? {
                estimatedDeliveryDate: nextDeliveryDate,
                ...(nextDeliveryLabel ? { deliveryLabel: nextDeliveryLabel } : {})
              }
            : {})
        };
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

const GUEST_HYDRATE_SETTLE_MS = 80;

export default function CartProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const mergeStartedRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);
  const skipNextSyncRef = useRef(false);
  const serverCartLoadedRef = useRef(false);
  const guestPersistReadyRef = useRef(false);
  const cartLocallyMutatedRef = useRef(false);
  const cartRef = useRef(state.cart);
  const userIdRef = useRef<string | null>(null);
  cartRef.current = state.cart;
  userIdRef.current = user?.id ?? null;

  const cartSyncKey = useMemo(
    () => state.cart.map((item) => `${item.id}:${item.qty}`).join("|"),
    [state.cart]
  );
  const hydrateGuest = useCallback(() => {
    if (userIdRef.current) return;

    skipNextSyncRef.current = true;
    guestPersistReadyRef.current = false;
    cartLocallyMutatedRef.current = false;
    dispatch({ type: "HYDRATE_CART", cart: readGuestCart() });
    guestPersistReadyRef.current = true;
    setIsHydrated(true);
  }, []);

  const hydrateAuthenticated = useCallback(async (expectedUserId: string) => {
    setIsHydrated(false);
    serverCartLoadedRef.current = false;
    skipNextSyncRef.current = true;
    guestPersistReadyRef.current = false;
    cartLocallyMutatedRef.current = false;
    try {
      const items = await loadUserCartFromBrowser();
      if (userIdRef.current !== expectedUserId) return;

      dispatch({ type: "HYDRATE_CART", cart: items });
      serverCartLoadedRef.current = true;
    } catch {
      if (userIdRef.current !== expectedUserId) return;
      serverCartLoadedRef.current = false;
    } finally {
      if (userIdRef.current === expectedUserId) {
        setIsHydrated(true);
      }
    }
  }, []);

  const dispatchCart = useCallback((action: CartActionType) => {
    if (action.type === "CHANGE_CART_AMOUNT" || action.type === "CLEAR_CART") {
      cartLocallyMutatedRef.current = true;
    }
    if (action.type === "HYDRATE_CART") {
      cartLocallyMutatedRef.current = false;
    }
    dispatch(action);
    if (action.type === "CLEAR_CART" && userIdRef.current) {
      void clearUserCartFromBrowser().catch(() => {
        // Local state cleared; server clear retries on next explicit action.
      });
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      mergeStartedRef.current = false;
      prevUserIdRef.current = null;
      serverCartLoadedRef.current = false;

      const timer = window.setTimeout(() => {
        if (userIdRef.current) return;
        hydrateGuest();
      }, GUEST_HYDRATE_SETTLE_MS);

      return () => window.clearTimeout(timer);
    }

    const isFreshLogin = prevUserIdRef.current == null;
    prevUserIdRef.current = user.id;

    let cancelled = false;
    setIsHydrated(false);

    const run = async () => {
      if (isFreshLogin && !mergeStartedRef.current) {
        mergeStartedRef.current = true;
        const guestCart = readGuestCart();
        if (guestCart.length > 0) {
          try {
            await mergeGuestCartFromBrowser(
              guestCart.map((item) => ({
                productId: item.productId,
                supplierProductId: item.supplierProductId,
                qty: item.qty
              }))
            );
            clearGuestCart();
          } catch {
            // Keep guest cart if merge fails; server cart still loads below.
          }
        }
      }

      if (cancelled) return;
      await hydrateAuthenticated(user.id);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, hydrateGuest, hydrateAuthenticated]);

  useEffect(() => {
    if (!isHydrated || user || !guestPersistReadyRef.current) return;

    if (state.cart.length === 0 && !cartLocallyMutatedRef.current && guestStorageHasItems()) {
      return;
    }

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
      const snapshot = cartRef.current;

      if (snapshot.length === 0) {
        if (cartLocallyMutatedRef.current) {
          void clearUserCartFromBrowser().catch(() => {
            // Keep local state; next change retries clear.
          });
        }
        return;
      }

      void syncUserCartFromBrowser(
        snapshot.map((item) => ({
          productId: item.productId,
          supplierProductId: item.supplierProductId,
          qty: item.qty
        }))
      ).catch(() => {
        // Keep local state; next change retries sync.
      });
    }, CART_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [isHydrated, user, authLoading, cartSyncKey]);

  useEffect(() => {
    if (state.cart.length === 0) return;

    const controller = new AbortController();
    const linesSnapshot = state.cart.map((item) => ({
      lineId: item.id,
      productId: item.productId,
      supplierProductId: item.supplierProductId
    }));

    const timer = setTimeout(() => {
      const syncPrices = async () => {
        try {
          const response = await fetch("/api/cart/prices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lines: linesSnapshot }),
            signal: controller.signal
          });
          if (!response.ok) return;
          const data = (await response.json()) as {
            prices?: {
              id: string;
              price: number;
              originalPrice?: number;
              estimatedDeliveryDate?: string;
              deliveryLabel?: string;
            }[];
            unavailableIds?: string[];
          };
          if (!Array.isArray(data.prices)) return;
          dispatch({ type: "SYNC_CART_PRICES", payloadList: data.prices });
          const unavailableIds = Array.isArray(data.unavailableIds) ? data.unavailableIds : [];
          if (unavailableIds.length > 0 && data.prices.length > 0) {
            dispatch({ type: "REMOVE_UNAVAILABLE_ITEMS", unavailableIds });
          }
        } catch {
          // No-op: cart should keep current values if sync fails.
        }
      };

      void syncPrices();
    }, CART_PRICE_SYNC_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cartSyncKey]);

  useEffect(() => {
    if (state.warning == null) return;
    const timer = setTimeout(() => {
      dispatch({ type: "CLEAR_CART_WARNING" });
    }, 7000);
    return () => clearTimeout(timer);
  }, [state.warning]);

  const contextValue = useMemo(
    () => ({ state, dispatch: dispatchCart, isHydrated }),
    [state, dispatchCart, isHydrated]
  );

  return <CartContext value={contextValue}>{children}</CartContext>;
}
