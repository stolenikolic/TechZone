import Shop from "./Shop.model";
import Review from "./Review.model";

export default interface Product {
  unit?: any;
  slug: string;
  price: number;
  /** When set and greater than price, shown crossed out as original price. */
  originalPrice?: number;
  title: string;
  rating: number;
  discount: number;
  thumbnail: string;
  description?: string;
  id: string;
  shop?: Shop;
  brand?: string;
  size?: string[];
  status?: string;
  colors?: string[];
  images: string[];
  categories: any[];
  /** Primary category for breadcrumb (from category_id relation). */
  category?: { name: string; slug: string };
  /** Parent category when category has parent_id (for breadcrumb: Home / Parent / Category / Product). */
  parentCategory?: { name: string; slug: string };
  reviews?: Review[];
  published?: boolean;
  masterStatus?: {
    value: "unlinked" | "linked" | "needs_attributes" | "ready";
    label: string;
    tooltip: string;
    missing: string[];
    supplierOffers: number;
  };
  /** Product specs from product_attributes + attributes; only set when present. */
  specifications?: { name: string; slug: string; value: string }[];
}
