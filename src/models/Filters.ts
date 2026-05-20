import type { SearchCategoryFacet } from "lib/search/search-category-facets";

export interface Category {
  title: string;
  children?: Array<string | { title: string; href: string }>;
}

export type RangeFilter = { min: number; max: number };

/** Single filter from API: slug, name, list of values. */
export type FilterItem = {
  slug: string;
  name: string;
  values: string[];
  displayType?: "checkbox" | "range";
  range?: RangeFilter;
  unit?: string;
  step?: number;
};

/** API-driven sidebar: filters array + price range + category nav. No hardcoded attribute names. */
export type CategorySidebarFilters = {
  filters: FilterItem[];
  priceRange?: RangeFilter;
  categories: Category[];
};

export type { SearchCategoryFacet };

/** Search results page: dynamic category facets from the current query. */
export type SearchPageFilters = CategorySidebarFilters & {
  searchCategoryFacets: SearchCategoryFacet[];
};

export function isSearchPageFilters(filters: unknown): filters is SearchPageFilters {
  return (
    typeof filters === "object" &&
    filters !== null &&
    "searchCategoryFacets" in filters &&
    Array.isArray((filters as SearchPageFilters).searchCategoryFacets)
  );
}
