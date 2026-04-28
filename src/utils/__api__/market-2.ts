import { cache } from "react";
import axios from "utils/axiosInstance";
import Brand from "models/Brand.model";
import Product from "models/Product.model";
import Service from "models/Service.model";
import { MainCarouselItem } from "models/Market-2.model";
import Category from "models/Category.model";
import Blog from "models/Blog.model";
import Shop from "models/Shop.model";
import { getServerBaseUrl } from "utils/site-url";

const CACHE_REVALIDATE_SECONDS = 60;

/** Base URL for server-side fetch (Next.js Data Cache requires absolute URLs). */
function getFetchBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  return getServerBaseUrl();
}

const getProducts = cache(async (): Promise<Product[]> => {
  const response = await axios.get("/api/market-2/products");
  return response.data;
});

const getFlashProducts = cache(async (): Promise<Product[]> => {
  const response = await axios.get("/api/market-2/flash-deals");
  return response.data;
});

const getTopRatedProducts = cache(async (): Promise<Product[]> => {
  const response = await axios.get("/api/market-2/top-rated");
  return response.data;
});

const getServices = cache(async (): Promise<Service[]> => {
  const response = await axios.get("/api/market-2/service");
  return response.data;
});

const getCategories = cache(async (): Promise<Category[]> => {
  if (typeof window === "undefined") {
    const base = getFetchBaseUrl();
    const res = await fetch(`${base}/api/market-2/categories`, {
      next: { revalidate: CACHE_REVALIDATE_SECONDS }
    });
    if (!res.ok) return [];
    return res.json();
  }
  const response = await axios.get<Category[]>("/api/market-2/categories");
  return response.data;
});

const getBrands = cache(async (): Promise<Brand[]> => {
  const response = await axios.get("/api/market-2/brand");
  return response.data;
});

const getShops = cache(async (): Promise<Shop[]> => {
  const response = await axios.get("/api/market-2/shops");
  return response.data;
});

const getMainCarouselData = cache(async (): Promise<MainCarouselItem[]> => {
  const response = await axios.get("/api/market-2/main-carousel");
  return response.data;
});

const getBlogs = cache(async (): Promise<Blog[]> => {
  const response = await axios.get("/api/market-2/articles");
  return response.data;
});

const getClients = cache(async (): Promise<Brand[]> => {
  const response = await axios.get("/api/market-2/clients");
  return response.data;
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
      const base = getFetchBaseUrl();
      const res = await fetch(`${base}${urlPath}`, {
        next: { revalidate: CACHE_REVALIDATE_SECONDS }
      });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    }
    const response = await axios.get<CategoryPagePayload>(urlPath, {
      validateStatus: (status) => status === 200 || status === 404
    });
    if (response.status === 404) return null;
    return response.data;
  }
);

/** Dynamic filters for a category (price range, brands, attribute ranges). */
const getCategoryFilters = cache(async (path: string): Promise<CategoryFiltersPayload | null> => {
  const encoded = encodeURIComponent(path);
  const urlPath = `/api/categories/${encoded}/filters`;
  if (typeof window === "undefined") {
    const base = getFetchBaseUrl();
    const res = await fetch(`${base}${urlPath}`, {
      next: { revalidate: CACHE_REVALIDATE_SECONDS }
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  }
  const response = await axios.get<CategoryFiltersPayload>(urlPath, {
    validateStatus: (status) => status === 200 || status === 404
  });
  if (response.status === 404) return null;
  return response.data;
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
