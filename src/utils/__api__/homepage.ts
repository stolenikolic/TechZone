import { unstable_cache } from "next/cache";
import { cache } from "react";
import axios from "utils/axiosInstance";
import { loadHomepageMainCarousel } from "lib/homepage/sections/load-carousel";
import { loadHomepageCategories } from "lib/homepage/sections/load-categories";
import { loadHomepageFlashDeals } from "lib/homepage/sections/load-flash-deals";
import { loadHomepageProducts } from "lib/homepage/sections/load-products";
import { loadHomepageTopRated } from "lib/homepage/sections/load-top-rated";
import {
  HOMEPAGE_ARTICLES,
  HOMEPAGE_BRANDS,
  HOMEPAGE_CLIENTS,
  HOMEPAGE_SERVICES,
  HOMEPAGE_SHOPS
} from "lib/homepage/sections/static-data";
import type { HeroCarouselItem } from "lib/homepage/types";
import Brand from "models/Brand.model";
import Product from "models/Product.model";
import Service from "models/Service.model";
import Category from "models/Category.model";
import Blog from "models/Blog.model";
import Shop from "models/Shop.model";

const MAIN_CAROUSEL_FALLBACK: HeroCarouselItem[] = [
  {
    id: "fallback-hero-1",
    title: "Tech Deals",
    imgUrl: "/assets/images/hero/hero-1.jpg",
    category: "Electronics",
    buttonLink: "/products",
    buttonLabel: "EXPLORE NOW",
    description: "Discover the latest gadgets and tech essentials."
  },
  {
    id: "fallback-hero-2",
    title: "New Arrivals",
    imgUrl: "/assets/images/hero/hero-2.jpg",
    category: "Featured",
    buttonLink: "/products",
    buttonLabel: "EXPLORE NOW",
    description: "Explore new products and exclusive offers."
  }
];

const SERVICES_FALLBACK: Service[] = HOMEPAGE_SERVICES;

/** Server-side loaders — no HTTP hop to NEXT_PUBLIC_SITE_URL during RSC. */
const SERVER_HOMEPAGE_LOADERS: Record<string, () => Promise<unknown[]>> = {
  "/api/homepage/service": async () => HOMEPAGE_SERVICES,
  "/api/homepage/brand": async () => HOMEPAGE_BRANDS,
  "/api/homepage/shops": async () => HOMEPAGE_SHOPS,
  "/api/homepage/articles": async () => HOMEPAGE_ARTICLES,
  "/api/homepage/clients": async () => HOMEPAGE_CLIENTS,
  "/api/homepage/products": loadHomepageProducts,
  "/api/homepage/flash-deals": loadHomepageFlashDeals,
  "/api/homepage/top-rated": loadHomepageTopRated,
  "/api/homepage/main-carousel": loadHomepageMainCarousel
};

function logApiError(path: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[homepage] ${path}: ${message}`);
}

async function getApiArray<T>(path: string, fallback: T[] = []): Promise<T[]> {
  try {
    if (typeof window === "undefined") {
      const loader = SERVER_HOMEPAGE_LOADERS[path];
      if (loader) return (await loader()) as T[];
      return fallback;
    }

    const response = await axios.get<T[]>(path);
    return response.data;
  } catch (error) {
    logApiError(path, error);
    return fallback;
  }
}

const getProducts = cache(async (): Promise<Product[]> => {
  return getApiArray<Product>("/api/homepage/products");
});

const getFlashProducts = cache(async (): Promise<Product[]> => {
  return getApiArray<Product>("/api/homepage/flash-deals");
});

const getTopRatedProducts = cache(async (): Promise<Product[]> => {
  return getApiArray<Product>("/api/homepage/top-rated");
});

const getServices = cache(async (): Promise<Service[]> => {
  return getApiArray<Service>("/api/homepage/service", SERVICES_FALLBACK);
});

async function fetchCategoriesFromApi(): Promise<Category[]> {
  try {
    return (await loadHomepageCategories()) as unknown as Category[];
  } catch (error) {
    logApiError("/api/homepage/categories", error);
    return [];
  }
}

const getCategories = unstable_cache(fetchCategoriesFromApi, ["homepage-categories-list"], {
  tags: ["homepage-categories"],
  revalidate: 30
});

const getBrands = cache(async (): Promise<Brand[]> => {
  return getApiArray<Brand>("/api/homepage/brand");
});

const getShops = cache(async (): Promise<Shop[]> => {
  return getApiArray<Shop>("/api/homepage/shops");
});

const getMainCarouselData = cache(async (): Promise<HeroCarouselItem[]> => {
  return getApiArray<HeroCarouselItem>("/api/homepage/main-carousel", MAIN_CAROUSEL_FALLBACK);
});

const getBlogs = cache(async (): Promise<Blog[]> => {
  return getApiArray<Blog>("/api/homepage/articles");
});

const getClients = cache(async (): Promise<Brand[]> => {
  return getApiArray<Brand>("/api/homepage/clients");
});

export type CategoryPagePayload = {
  category: { id: string; name: string; slug: string };
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
};

export type FilterItem = { slug: string; name: string; values: string[] };

export type CategoryFiltersPayload = {
  priceRange?: { min: number; max: number };
  filters?: FilterItem[];
  /** @deprecated Use filters (slug: "brand") instead */
  brands?: { label: string; value: string }[];
  capacityRange?: { min: number; max: number };
  rpmRange?: { min: number; max: number };
  bufferRange?: { min: number; max: number };
  sizeOptions?: string[];
  connectionOptions?: string[];
  readSpeedRange?: { min: number; max: number };
  writeSpeedRange?: { min: number; max: number };
  pcieGenerationOptions?: string[];
  heatsinkOptions?: string[];
};

/** path: single slug or hierarchical path; page: 1-based. filterParams: optional URL search params (prices, brands, capacity, rpm, buffer, size) to apply server-side. */
const getCategoryBySlug = cache(
  async (
    path: string,
    page = 1,
    filterParams?: Record<string, string | string[] | undefined>
  ): Promise<CategoryPagePayload | null> => {
    try {
      const encoded = encodeURIComponent(path);
      const searchParams = new URLSearchParams({ page: String(page) });
      if (filterParams) {
        for (const [key, value] of Object.entries(filterParams)) {
          if (value === undefined || value === null) continue;
          searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
        }
      }
      const query = searchParams.toString();
      const urlPath = `/api/categories/${encoded}${query ? `?${query}` : ""}`;
      if (typeof window === "undefined") {
        const { getCategoryProductsForPath } = await import("lib/shop-category-listing");
        const result = await getCategoryProductsForPath(path, {
          ...filterParams,
          page: String(page)
        });
        if (result == null || "error" in result) return null;
        return {
          category: result.category,
          products: result.products,
          total: result.total,
          page: result.page,
          totalPages: result.totalPages
        };
      }
      const response = await axios.get<CategoryPagePayload>(urlPath, {
        validateStatus: (status) => status === 200 || status === 404
      });
      if (response.status === 404) return null;
      return response.data;
    } catch (error) {
      logApiError(`/api/categories/${path}`, error);
      return null;
    }
  }
);

/** Dynamic filters for a category (price range, brands, attribute ranges). */
const getCategoryFilters = cache(async (path: string): Promise<CategoryFiltersPayload | null> => {
  try {
    const encoded = encodeURIComponent(path);
    const urlPath = `/api/categories/${encoded}/filters`;
    if (typeof window === "undefined") {
      const { getCategoryFiltersForPath } = await import("lib/shop-category-listing");
      const result = await getCategoryFiltersForPath(path);
      if (result == null || "error" in result) return null;
      return result as CategoryFiltersPayload;
    }
    const response = await axios.get<CategoryFiltersPayload>(urlPath, {
      validateStatus: (status) => status === 200 || status === 404
    });
    if (response.status === 404) return null;
    return response.data;
  } catch (error) {
    logApiError(`/api/categories/${path}/filters`, error);
    return null;
  }
});

export default {
  getBrands,
  getCategoryBySlug,
  getCategoryFilters,
  getServices,
  getCategories,
  getFlashProducts,
  getTopRatedProducts,
  getMainCarouselData,
  getBlogs,
  getProducts,
  getShops,
  getClients
};
