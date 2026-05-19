import { cache } from "react";
import type Product from "models/Product.model";
import type { SearchPageFilters } from "models/Filters";
import type { SearchCategoryFacet } from "lib/search/search-category-facets";
import {
  formatCategorySlugsParam,
  parseCategorySlugsParam
} from "lib/search/product-search-tokens";
import { mapProductPriceFields } from "lib/effective-price";
import { getServerBaseUrl } from "utils/site-url";

type SearchResultItem = {
  id: string;
  name: string;
  brand: string | null;
  slug: string;
  main_image: string | null;
  price: number | null;
  originalPrice?: number;
  topPick?: boolean;
  topPickLabel?: string;
};

const PER_PAGE = 30;

function getFetchBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  return getServerBaseUrl();
}

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

function buildSearchApiUrl(params: {
  query: string;
  pageNum: number;
  category?: string;
  brands?: string;
  prices?: string;
  sort?: string;
}): string {
  const base = getFetchBaseUrl();
  const searchParams = new URLSearchParams({
    q: params.query,
    page: String(params.pageNum)
  });

  const slugs = parseCategorySlugsParam(params.category);
  if (slugs.length > 0) {
    searchParams.set("category", formatCategorySlugsParam(slugs));
  }
  if (params.brands?.trim()) searchParams.set("brands", params.brands.trim());
  if (params.prices?.trim()) searchParams.set("prices", params.prices.trim());
  if (params.sort?.trim()) searchParams.set("sort", params.sort.trim());

  return `${base}/api/search?${searchParams.toString()}`;
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
    const url = buildSearchApiUrl({
      query,
      pageNum,
      category: params.category,
      brands: params.brands,
      prices: params.prices,
      sort: params.sort
    });
    const res = await fetch(url, { next: { revalidate: 60 } });

    if (!res.ok) {
      if (res.status === 400) return empty;
      throw new Error(`Search failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      products: SearchResultItem[];
      totalResults: number;
      totalPages: number;
      currentPage: number;
      categoryFacets?: SearchCategoryFacet[];
      priceRange?: { min: number; max: number };
      filters?: SearchPageFilters["filters"];
    };

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
