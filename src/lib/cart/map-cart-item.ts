import { getEffectivePrice } from "lib/effective-price";
import type { CartItem } from "contexts/CartContext";
import type { DbCartProductRow } from "./types";

export function mapProductToCartItem(row: DbCartProductRow, qty: number): CartItem {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
  const price = getEffectivePrice(row.custom_price, row.price);
  const quantity = Math.max(1, Math.floor(Number(qty)));

  return {
    id: String(row.id),
    slug: row.slug?.trim() || String(row.id),
    title: row.name?.trim() || "Product",
    thumbnail,
    price,
    qty: quantity
  };
}
