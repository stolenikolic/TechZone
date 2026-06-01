"use client";

import { createSupabaseBrowserClient } from "utils/supabase/browser";
import {
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

export async function loadUserCartFromBrowser() {
  const { supabase, userId } = await getSupabaseWithSession();
  return getCartForUser(supabase, userId);
}

export async function mergeGuestCartFromBrowser(
  guestItems: { id: string; qty: number }[]
) {
  const { supabase, userId } = await getSupabaseWithSession();
  return mergeGuestCart(supabase, userId, guestItems);
}

export async function syncUserCartFromBrowser(items: { id: string; qty: number }[]) {
  const { supabase, userId } = await getSupabaseWithSession();
  return replaceCartForUser(supabase, userId, items);
}
