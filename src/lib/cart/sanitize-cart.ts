import { buildCartLineId, parseCartLineId } from "./cart-line-id";
import type { CartItem } from "contexts/CartContext";
import type { OfferChoiceKey } from "lib/product-offers";

function isOfferChoice(value: unknown): value is OfferChoiceKey {
  return value === "cheapest" || value === "fastest";
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function sanitizeCartItem(row: Record<string, unknown>): CartItem | null {
  const price = toFiniteNumber(row.price);
  const qty = toFiniteNumber(row.qty);

  if (
    typeof row.slug !== "string" ||
    typeof row.title !== "string" ||
    typeof row.thumbnail !== "string" ||
    price == null ||
    price < 0 ||
    qty == null
  ) {
    return null;
  }

  let productId = typeof row.productId === "string" ? row.productId.trim() : "";
  let supplierProductId =
    typeof row.supplierProductId === "string" ? row.supplierProductId.trim() : "";

  if (!productId || !supplierProductId) {
    if (typeof row.id !== "string") return null;
    const parsed = parseCartLineId(row.id);
    productId = productId || parsed.productId;
    supplierProductId = supplierProductId || parsed.supplierProductId || "";
  }

  if (!productId || !supplierProductId) return null;

  const id =
    typeof row.id === "string" && row.id.includes(":")
      ? row.id
      : buildCartLineId(productId, supplierProductId);

  const offerChoice = isOfferChoice(row.offerChoice) ? row.offerChoice : "cheapest";
  const deliveryLabel =
    typeof row.deliveryLabel === "string" && row.deliveryLabel.trim()
      ? row.deliveryLabel.trim()
      : undefined;
  const estimatedDeliveryDate =
    typeof row.estimatedDeliveryDate === "string" && row.estimatedDeliveryDate.trim()
      ? row.estimatedDeliveryDate.trim()
      : undefined;
  const originalPrice =
    typeof row.originalPrice === "number" && Number.isFinite(row.originalPrice) && row.originalPrice > 0
      ? row.originalPrice
      : undefined;

  return {
    id,
    productId,
    supplierProductId,
    offerChoice,
    deliveryLabel,
    estimatedDeliveryDate,
    originalPrice,
    slug: row.slug,
    title: row.title,
    thumbnail: row.thumbnail,
    price,
    qty: Math.max(1, Math.floor(qty))
  };
}

export function sanitizeCart(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      return sanitizeCartItem(item as Record<string, unknown>);
    })
    .filter((item): item is CartItem => item != null);
}
