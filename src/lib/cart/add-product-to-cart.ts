"use client";

import type { CartItem } from "contexts/CartContext";
import { buildCartItemPayload } from "lib/cart/cart-item-payload";
import type { OfferChoiceKey } from "lib/product-offers";
import Product from "models/Product.model";

type Dispatch = (action: {
  type: "CHANGE_CART_AMOUNT";
  addToExisting?: boolean;
  payload: CartItem;
}) => void;

type DefaultOfferResponse = {
  supplierProductId: string;
  sellingPrice: number;
  originalPrice?: number;
  offerChoice: OfferChoiceKey;
  deliveryLabel: string;
  estimatedDeliveryDate: string;
};

async function fetchDefaultOffer(productId: string): Promise<DefaultOfferResponse | null> {
  try {
    const res = await fetch(`/api/cart/default-offer?productId=${encodeURIComponent(productId)}`);
    if (!res.ok) return null;
    return (await res.json()) as DefaultOfferResponse;
  } catch {
    return null;
  }
}

export async function buildCartItemForAdd(product: Product, qty: number): Promise<CartItem | null> {
  const thumbnail = product.thumbnail ?? "/assets/images/placeholder.png";
  const offers = product.productOffers;
  const cheapestOffer =
    offers?.cheapestOfferId != null
      ? offers.offers.find((o) => o.id === offers.cheapestOfferId) ?? null
      : null;

  if (cheapestOffer && cheapestOffer.sellingPrice > 0) {
    return buildCartItemPayload({
      productId: product.id,
      title: product.title,
      slug: product.slug,
      thumbnail,
      qty,
      offer: cheapestOffer,
      offerChoice: "cheapest"
    });
  }

  if (product.price > 0) {
    const remote = await fetchDefaultOffer(product.id);
    if (remote && remote.sellingPrice > 0) {
      return buildCartItemPayload({
        productId: product.id,
        title: product.title,
        slug: product.slug,
        thumbnail,
        qty,
        offer: {
          id: remote.supplierProductId,
          sellingPrice: remote.sellingPrice,
          originalPrice: remote.originalPrice ?? 0,
          estimatedDeliveryDate: remote.estimatedDeliveryDate,
          deliveryLabel: remote.deliveryLabel
        },
        offerChoice: remote.offerChoice
      });
    }
  }

  return null;
}

export async function addProductToCart(
  dispatch: Dispatch,
  product: Product,
  options?: { qty?: number; navigateToMiniCart?: boolean; router?: { push: (url: string, opts?: object) => void } }
): Promise<boolean> {
  const qty = options?.qty ?? 1;
  const item = await buildCartItemForAdd(product, qty);
  if (!item) return false;

  dispatch({
    type: "CHANGE_CART_AMOUNT",
    addToExisting: true,
    payload: item
  });

  if (options?.navigateToMiniCart !== false && options?.router) {
    options.router.push("/mini-cart", { scroll: false });
  }

  return true;
}
