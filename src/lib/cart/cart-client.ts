"use client";

import type { CartItem } from "contexts/CartContext";
import { createSupabaseBrowserClient } from "utils/supabase/browser";
import { sanitizeCart } from "./sanitize-cart";
import {
  clearCartForUser,
  getCartForUser,
  mergeGuestCart,
  replaceCartForUser
} from "./cart-repository";

const SESSION_WAIT_MS = 100;
const SESSION_MAX_ATTEMPTS = 20;

async function getSupabaseWithSession() {
  const supabase = createSupabaseBrowserClient();

  for (let attempt = 0; attempt < SESSION_MAX_ATTEMPTS; attempt += 1) {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (session?.user) return { supabase, userId: session.user.id };
    await new Promise((resolve) => setTimeout(resolve, SESSION_WAIT_MS));
  }

  throw new Error("No session");
}

/** Loads cart via API (service role) so offer rows resolve reliably after reload. */
async function fetchCartFromApi(): Promise<CartItem[] | null> {
  try {
    const res = await fetch("/api/cart", { credentials: "include", cache: "no-store" });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: unknown };
    return sanitizeCart(data.items ?? []);
  } catch {
    return null;
  }
}

export async function loadUserCartFromBrowser(): Promise<CartItem[]> {
  const fromApi = await fetchCartFromApi();
  if (fromApi != null) return fromApi;

  const { supabase, userId } = await getSupabaseWithSession();
  return getCartForUser(supabase, userId);
}

export async function mergeGuestCartFromBrowser(
  guestItems: {
    productId: string;
    supplierProductId: string;
    qty: number;
  }[]
) {
  const { supabase, userId } = await getSupabaseWithSession();
  return mergeGuestCart(supabase, userId, guestItems);
}

export async function syncUserCartFromBrowser(
  items: {
    productId: string;
    supplierProductId: string;
    qty: number;
  }[]
) {
  if (items.length === 0) return;
  const { supabase, userId } = await getSupabaseWithSession();
  return replaceCartForUser(supabase, userId, items);
}

export async function clearUserCartFromBrowser() {
  const { supabase, userId } = await getSupabaseWithSession();
  return clearCartForUser(supabase, userId);
}
