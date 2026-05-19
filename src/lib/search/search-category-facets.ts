import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTokenFilter } from "lib/search/product-search-tokens";

export type SearchCategoryFacet = {
  slug: string;
  name: string;
  count: number;
};

const FACET_PAGE_SIZE = 1000;

type CategoryRow = { id: string; slug: string; name: string };

/**
 * Count products per category for a token search (full result set, not one page).
 */
export async function fetchSearchCategoryFacets(
  supabase: SupabaseClient,
  tokens: string[]
): Promise<SearchCategoryFacet[]> {
  if (tokens.length === 0) return [];

  const countsByCategoryId = new Map<string, number>();
  let offset = 0;

  while (true) {
    let query = supabase
      .from("products")
      .select("category_id")
      .eq("is_active", true)
      .not("category_id", "is", null);

    for (const token of tokens) {
      query = query.or(buildTokenFilter(token));
    }

    const { data, error } = await query.range(offset, offset + FACET_PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const categoryId = row.category_id as string;
      countsByCategoryId.set(categoryId, (countsByCategoryId.get(categoryId) ?? 0) + 1);
    }

    if (rows.length < FACET_PAGE_SIZE) break;
    offset += FACET_PAGE_SIZE;
  }

  if (countsByCategoryId.size === 0) return [];

  const categoryIds = Array.from(countsByCategoryId.keys());
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, slug, name")
    .in("id", categoryIds);

  if (categoriesError) {
    throw new Error(categoriesError.message);
  }

  const facets: SearchCategoryFacet[] = ((categories ?? []) as CategoryRow[])
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      count: countsByCategoryId.get(category.id) ?? 0
    }))
    .filter((facet) => facet.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, "sr");
    });

  return facets;
}

export async function resolveCategoryIdsBySlugs(
  supabase: SupabaseClient,
  slugs: string[]
): Promise<string[]> {
  if (slugs.length === 0) return [];

  const { data, error } = await supabase.from("categories").select("id, slug").in("slug", slugs);

  if (error) {
    throw new Error(error.message);
  }

  const slugSet = new Set(slugs);
  return ((data ?? []) as { id: string; slug: string }[])
    .filter((row) => slugSet.has(row.slug.toLowerCase()))
    .map((row) => row.id);
}
