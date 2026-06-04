import { buildCartLineId } from "lib/cart/cart-line-id";
import type { CartItem } from "contexts/CartContext";
import { formatRokIsporuke, type OfferChoiceKey, type StorefrontProductOffer } from "lib/product-offers";

type BuildCartItemParams = {
  productId: string;
  title: string;
  slug: string;
  thumbnail: string;
  qty: number;
  offer: Pick<
    StorefrontProductOffer,
    "id" | "sellingPrice" | "originalPrice" | "estimatedDeliveryDate" | "deliveryLabel"
  >;
  offerChoice: OfferChoiceKey;
};

export function buildCartItemPayload(params: BuildCartItemParams): CartItem {
  const { productId, offer, offerChoice, qty, title, slug, thumbnail } = params;
  return {
    id: buildCartLineId(productId, offer.id),
    productId,
    supplierProductId: offer.id,
    offerChoice,
    deliveryLabel: formatRokIsporuke(offer),
    estimatedDeliveryDate: offer.estimatedDeliveryDate,
    originalPrice: offer.originalPrice > 0 ? offer.originalPrice : undefined,
    price: offer.sellingPrice,
    title,
    slug,
    thumbnail,
    qty: Math.max(1, Math.floor(qty))
  };
}
