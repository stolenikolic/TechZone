import type Product from "models/Product.model";
import { parseNumericFromAttributeValue } from "lib/shop/range-filter-utils";

export type ProductSpecFilterItem = {
  name: string;
  slug: string;
  value: string;
  filterDisplayType?: "checkbox" | "range" | null;
};

/** Leaf category path for shop links (matches breadcrumb). */
export function getLeafCategoryHref(product: Pick<Product, "category" | "parentCategory">): string | null {
  if (!product.category) return null;
  if (product.parentCategory) {
    return `/categories/${product.parentCategory.slug}/${product.category.slug}`;
  }
  return `/categories/${product.category.slug}`;
}

/** @deprecated Use parseNumericFromAttributeValue */
export const parseNumericFromSpecValue = parseNumericFromAttributeValue;

/**
 * Build query param for a spec filter link.
 * Returns null when the spec must not be linked (brand, unknown type, unparseable range).
 */
export function buildSpecFilterQueryParam(
  spec: ProductSpecFilterItem
): { key: string; value: string } | null {
  if (spec.slug === "brand") return null;
  if (!spec.filterDisplayType) return null;

  if (spec.filterDisplayType === "range") {
    const n = parseNumericFromAttributeValue(spec.value);
    if (n == null) return null;
    return { key: spec.slug, value: `${n}-${n}` };
  }

  return { key: spec.slug, value: spec.value };
}

export function buildCategorySpecFilterHref(
  categoryHref: string | null,
  spec: ProductSpecFilterItem
): string | null {
  if (!categoryHref) return null;
  const param = buildSpecFilterQueryParam(spec);
  if (!param) return null;
  const search = new URLSearchParams({ [param.key]: param.value });
  return `${categoryHref}?${search.toString()}`;
}
