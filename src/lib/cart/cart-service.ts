import { createSupabaseServiceClient } from "utils/supabase";
import {
  clearCartForUser as clearCartRepo,
  getCartForUser as getCartRepo,
  mergeGuestCart as mergeGuestRepo,
  replaceCartForUser as replaceCartRepo
} from "./cart-repository";

export { normalizeLineInputs } from "./cart-repository";

export async function getCartForUser(userId: string) {
  return getCartRepo(createSupabaseServiceClient(), userId);
}

export async function replaceCartForUser(
  userId: string,
  items: { id?: string; productId?: string; qty?: unknown }[]
) {
  return replaceCartRepo(createSupabaseServiceClient(), userId, items);
}

export async function mergeGuestCart(
  userId: string,
  guestItems: { id?: string; productId?: string; qty?: unknown }[]
) {
  return mergeGuestRepo(createSupabaseServiceClient(), userId, guestItems);
}

export async function clearCartForUser(userId: string) {
  return clearCartRepo(createSupabaseServiceClient(), userId);
}
