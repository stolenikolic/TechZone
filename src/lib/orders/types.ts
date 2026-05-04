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

export type OrderCartItem = {
  id: string;
  qty: number;
};

export type CreateOrderPayload = {
  checkout: CheckoutDetails;
  items: OrderCartItem[];
};
