export type CartLineInput = {
  productId: string;
  qty: number;
};

export type DbCartProductRow = {
  id: string;
  name: string | null;
  slug: string | null;
  main_image: string | null;
  price: number | null;
  custom_price: number | null;
  is_active: boolean | null;
  publish_locked: boolean | null;
};

export type DbCartItemRow = {
  product_id: string;
  quantity: number;
  created_at: string;
};
