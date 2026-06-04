import type { CartItem } from "contexts/CartContext";
import { parseCartLineId } from "./cart-line-id";
import { sanitizeCart } from "./sanitize-cart";

export const GUEST_CART_STORAGE_KEY = "techzone_guest_cart_v2";
const LEGACY_CART_STORAGE_KEY = "techzone_guest_cart_v1";

function migrateLegacyRow(row: Record<string, unknown>): Record<string, unknown> {
  const next = { ...row };

  let productId = typeof next.productId === "string" ? next.productId.trim() : "";
  let supplierProductId =
    typeof next.supplierProductId === "string" ? next.supplierProductId.trim() : "";

  if (typeof next.id === "string") {
    const parsed = parseCartLineId(next.id);
    productId = productId || parsed.productId;
    supplierProductId = supplierProductId || parsed.supplierProductId || "";
  }

  if (productId) next.productId = productId;
  if (supplierProductId) next.supplierProductId = supplierProductId;

  if (typeof next.offerChoice !== "string") {
    next.offerChoice = "cheapest";
  }

  return next;
}

function parseStoredCart(raw: string): CartItem[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];

  return sanitizeCart(
    parsed.map((item) => {
      if (!item || typeof item !== "object") return item;
      return migrateLegacyRow(item as Record<string, unknown>);
    })
  );
}

export function readGuestCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (raw) return parseStoredCart(raw);

    const legacyRaw = window.localStorage.getItem(LEGACY_CART_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = parseStoredCart(legacyRaw);
      if (migrated.length > 0) {
        writeGuestCart(migrated);
      }
      window.localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
      return migrated;
    }

    return [];
  } catch {
    return [];
  }
}

export function writeGuestCart(cart: CartItem[]) {
  try {
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Ignore storage errors.
  }
}

export function clearGuestCart() {
  try {
    window.localStorage.removeItem(GUEST_CART_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

/** Avoid wiping a non-empty stored cart with a transient empty in-memory state. */
export function guestStorageHasItems(): boolean {
  try {
    const raw = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (!raw || raw === "[]") return false;
    return parseStoredCart(raw).length > 0;
  } catch {
    return false;
  }
}
