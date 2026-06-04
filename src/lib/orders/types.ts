import type { OfferChoiceKey } from "lib/product-offers";

export type CheckoutCountry = {
  label: string;
  value: string;
};

export type CheckoutDetails = {
  shipping_name: string;
  shipping_email: string;
  shipping_contact: string;
  shipping_city: string;
  shipping_company?: string;
  shipping_country: CheckoutCountry;
  shipping_zip: string;
  shipping_address1: string;
  shipping_address2?: string;
  delivery_notes?: string;
  same_as_shipping?: boolean;
  billing_name?: string;
  billing_email?: string;
  billing_contact?: string;
  billing_country?: CheckoutCountry;
  billing_zip?: string;
  billing_address1?: string;
  billing_address2?: string;
};

/** Cart line sent from checkout (snapshot fields). */
export type OrderCartLineInput = {
  /** Composite line id or legacy product id */
  id?: string;
  lineId?: string;
  productId?: string;
  supplierProductId?: string;
  qty: number;
  unitPrice?: number;
  offerChoice?: OfferChoiceKey;
  offerLabel?: string;
  deliveryLabel?: string;
  title?: string;
  slug?: string;
  thumbnail?: string;
};

export type ValidatedOrderLine = {
  lineId: string;
  productId: string;
  supplierProductId: string | null;
  qty: number;
  unitPrice: number;
  offerChoice: OfferChoiceKey | null;
  offerLabel: string | null;
  deliveryLabel: string | null;
  title: string | null;
  slug: string | null;
  thumbnail: string | null;
};

/** @deprecated Use OrderCartLineInput */
export type OrderCartItem = {
  id: string;
  qty: number;
};

export type CreateOrderPayload = {
  checkout: CheckoutDetails;
  items: OrderCartLineInput[];
};
