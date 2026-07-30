import { cache } from "react";
import type Product from "models/Product.model";
import type { SearchPageFilters } from "models/Filters";
import type { SearchCategoryFacet } from "lib/search/search-category-facets";
import {
  formatCategorySlugsParam,
  parseCategorySlugsParam
} from "lib/search/product-search-tokens";
import { resolveSearchResults, type SearchResultItem } from "lib/search/resolve-search-results";

const PER_PAGE = 30;

const PLACEHOLDER_IMAGE = "/assets/images/placeholder.png";

function searchResultToProduct(row: SearchResultItem): Product {
  const thumbnail = row.main_image ?? PLACEHOLDER_IMAGE;
  const price = row.price != null && Number.isFinite(Number(row.price)) ? Number(row.price) : 0;
  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    price,
    ...(row.originalPrice != null && { originalPrice: row.originalPrice }),
    rating: 0,
    discount: 0,
    thumbnail,
    images: [thumbnail],
    categories: [],
    published: true,
    ...(row.brand != null && { brand: row.brand }),
    ...(row.topPick && { topPick: true, topPickLabel: row.topPickLabel ?? "Top pick" })
  };
}

export type SearchPageData = {
  products: Product[];
  pageCount: number;
  totalProducts: number;
  firstIndex: number;
  lastIndex: number;
  categoryFacets: SearchCategoryFacet[];
  filters: SearchPageFilters;
};

interface Params {
  q?: string;
  page?: string;
  sale?: string;
  sort?: string;
  prices?: string;
  colors?: string;
  brands?: string;
  rating?: string;
  category?: string;
}

/** Normalize the category param the same way the API route's URL query used to. */
function normalizeCategoryParam(category?: string): string | undefined {
  const slugs = parseCategorySlugsParam(category);
  return slugs.length > 0 ? formatCategorySlugsParam(slugs) : undefined;
}

export const getSearchPageData = cache(async (params: Params): Promise<SearchPageData> => {
  const query = (params.q ?? "").trim();
  const pageNum = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const empty: SearchPageData = {
    products: [],
    pageCount: 1,
    totalProducts: 0,
    firstIndex: 0,
    lastIndex: 0,
    categoryFacets: [],
    filters: {
      filters: [],
      priceRange: undefined,
      categories: [],
      searchCategoryFacets: []
    }
  };

  if (query.length < 2) {
    return empty;
  }

  try {
    // Resolve in-process instead of doing a self HTTP fetch to our own /api/search
    // route — avoids an extra network hop (and a second function invocation on
    // Netlify) on every search render.
    const result = await resolveSearchResults({
      q: query,
      page: pageNum,
      sort: params.sort,
      prices: params.prices,
      brands: params.brands,
      category: normalizeCategoryParam(params.category)
    });

    if (!result.ok) {
      if (result.status === 400) return empty;
      throw new Error(`Search failed: ${result.status} ${result.error}`);
    }

    const data = result.data;
    const categoryFacets = data.categoryFacets ?? [];
    const products: Product[] = (data.products ?? []).map(searchResultToProduct);
    const totalProducts = Number(data.totalResults ?? 0);
    const pageCount = Math.max(1, Number(data.totalPages ?? 1));
    const currentPage = Math.min(pageNum, pageCount);

    const firstIndex = totalProducts === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1;
    const lastIndex = totalProducts === 0 ? 0 : Math.min(currentPage * PER_PAGE, totalProducts);

    return {
      products,
      pageCount,
      totalProducts,
      firstIndex,
      lastIndex,
      categoryFacets,
      filters: {
        filters: data.filters ?? [],
        priceRange: data.priceRange,
        categories: [],
        searchCategoryFacets: categoryFacets
      }
    };
  } catch (err) {
    console.error("[product-search]", err);
    return empty;
  }
});
