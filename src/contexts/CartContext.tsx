"use client";

import { createContext, PropsWithChildren, useEffect, useMemo, useReducer } from "react";

// =================================================================================
type InitialState = { cart: CartItem[] };

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
  type: "CHANGE_CART_AMOUNT" | "CLEAR_CART" | "SYNC_CART_PRICES";
}

// =================================================================================
const INITIAL_STATE: InitialState = { cart: [] };

// ==============================================================
interface ContextProps {
  state: InitialState;
  dispatch: (args: CartActionType) => void;
}
// ==============================================================

export const CartContext = createContext<ContextProps>({} as ContextProps);

const reducer = (state: InitialState, action: CartActionType) => {
  switch (action.type) {
    case "CHANGE_CART_AMOUNT":
      const cartList = state.cart;
      const cartItem = action.payload;

      if (cartItem === undefined) return state;

      const existIndex = cartList.findIndex((item) => item.id === cartItem!.id);

      // REMOVE ITEM IF QUANTITY IS LESS THAN 1
      if (cartItem.qty < 1) {
        const updatedCart = cartList.filter((item) => item.id !== cartItem!.id);
        return { ...state, cart: updatedCart };
      }

      // IF PRODUCT ALREADY EXITS IN CART
      if (existIndex > -1) {
        const updatedCart = [...cartList];
        updatedCart[existIndex] = {
          ...updatedCart[existIndex],
          qty: cartItem.qty,
          // Keep cart metadata in sync when re-adding from latest product payload.
          price: cartItem.price,
          title: cartItem.title,
          slug: cartItem.slug,
          thumbnail: cartItem.thumbnail
        };
        return { ...state, cart: updatedCart };
      }

      return { ...state, cart: [...cartList, cartItem] };

    case "CLEAR_CART":
      return { ...state, cart: [] };
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

    default: {
      return state;
    }
  }
};

export default function CartProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  useEffect(() => {
    if (state.cart.length === 0) return;
    const controller = new AbortController();

    const syncPrices = async () => {
      try {
        const response = await fetch("/api/cart/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: state.cart.map((item) => item.id) }),
          signal: controller.signal
        });
        if (!response.ok) return;
        const data = (await response.json()) as { prices?: { id: string; price: number }[] };
        if (!Array.isArray(data.prices)) return;
        dispatch({ type: "SYNC_CART_PRICES", payloadList: data.prices });
      } catch {
        // No-op: cart should keep current values if sync fails.
      }
    };

    void syncPrices();
    return () => controller.abort();
  }, [state.cart.length, state.cart.map((item) => `${item.id}:${item.qty}`).join("|")]);

  const contextValue = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return <CartContext value={contextValue}>{children}</CartContext>;
}
