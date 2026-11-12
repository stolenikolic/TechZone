import { cache } from "react";
import { resolveCategoryBySlugPathCached, normalizeCategorySlugParam } from "lib/shop-category-listing";
import { createSupabaseServiceClient } from "utils/supabase";
import {
  categoryPublicHref,
  indexCategoryLinks,
  isCategoryViewPointer,
  type CategoryLinkRow
} from "lib/shop/category-view-href";

/** Own pointer URL redirects to the source category with the filter already applied. */
export const pointerRedirectHrefForPath = cache(async (categoryPath: string): Promise<string | null> => {
  const normalized = normalizeCategorySlugParam(categoryPath);
  if (!normalized) return null;

  const category = await resolveCategoryBySlugPathCached(normalized);
  if (!category) return null;

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("categories")
    .select(
      "id, slug, parent_id, view_source_category_id, view_filter_attribute_slug, view_filter_value"
    );

  if (error) throw new Error(error.message);

  const byId = indexCategoryLinks((data ?? []) as CategoryLinkRow[]);
  const row = byId.get(category.id);
  if (!row || !isCategoryViewPointer(row)) return null;
  return categoryPublicHref(row, byId);
});
