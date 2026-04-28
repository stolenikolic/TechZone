export interface PreviewFile extends File {
  preview: string;
}

export interface SlugParams {
  params: Promise<{ slug: string }>;
}

export interface IdParams {
  params: Promise<{ id: string }>;
}

export interface Category {
  path: string;
  name: string;
  icon?: string;
  children?: Category[];
}

export interface DeliveryAddress {
  id: number;
  name: string;
  phone: string;
  street2: string;
  street1: string;
  city: string;
  state: string;
  country: string;
  zip: string;
}

export interface DeliveryTime {
  label: string;
  value: string;
}

export interface PaymentCard {
  name: string;
  cardType: string;
  last4Digits: string;
}
