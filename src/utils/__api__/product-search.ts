import { cache } from "react";
import type Product from "models/Product.model";
import type { CategorySidebarFilters } from "models/Filters";
import { getServerBaseUrl } from "utils/site-url";

type SearchResultItem = {
  id: string;
  name: string;
  brand: string | null;
  slug: string;
  main_image: string | null;
  price: number | null;
};

const PER_PAGE = 30;

/** Base URL for server-side fetch. */
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
    rating: 0,
    discount: 0,
    thumbnail,
    images: [thumbnail],
    categories: [],
    published: true,
    ...(row.brand != null && { brand: row.brand })
  };
}

/** Minimal filters for search/shop pages: empty dynamic shape (no category-specific filters). */
export const getFilters = cache(async (): Promise<CategorySidebarFilters> => {
  return {
    filters: [],
    priceRange: undefined,
    categories: []
  };
});

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

/**
 * Fetches paginated search results from /api/search?q=...&page=...
 * 30 products per page. Token search over name, brand, MPN, and EAN; is_active only.
 */
export const getProducts = cache(
  async ({ q, page = "1", sort, sale, prices, colors, brands, rating, category }: Params) => {
    const query = (q ?? "").trim();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);

    if (query.length < 2) {
      return {
        products: [] as Product[],
        pageCount: 1,
        totalProducts: 0,
        firstIndex: 0,
        lastIndex: 0
      };
    }

    try {
      const base = getFetchBaseUrl();
      const url = `${base}/api/search?q=${encodeURIComponent(query)}&page=${pageNum}`;
      const res = await fetch(url, { next: { revalidate: 60 } });

      if (!res.ok) {
        if (res.status === 400) {
          return {
            products: [] as Product[],
            pageCount: 1,
            totalProducts: 0,
            firstIndex: 0,
            lastIndex: 0
          };
        }
        throw new Error(`Search failed: ${res.status}`);
      }

      const data = (await res.json()) as {
        products: SearchResultItem[];
        totalResults: number;
        totalPages: number;
        currentPage: number;
      };

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
        lastIndex
      };
    } catch (err) {
      console.error("[product-search]", err);
      return {
        products: [] as Product[],
        pageCount: 1,
        totalProducts: 0,
        firstIndex: 0,
        lastIndex: 0
      };
    }
  }
);
