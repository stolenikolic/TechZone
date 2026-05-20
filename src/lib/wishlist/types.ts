import type Product from "models/Product.model";

export type WishlistProduct = Product & {
  isUnavailable?: boolean;
};

export type DbWishlistProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
  rating: number | null;
  price: number | null;
  custom_price: number | null;
  original_price: number | null;
  is_active: boolean | null;
  publish_locked: boolean | null;
  categories?: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
};
