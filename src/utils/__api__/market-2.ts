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

const MAIN_CAROUSEL_FALLBACK: MainCarouselItem[] = [
  {
    id: 1,
    title: "Tech Deals",
    imgUrl: "/assets/images/hero/hero-1.jpg",
    category: "Electronics",
    buttonLink: "/products",
    description: "Discover the latest gadgets and tech essentials."
  },
  {
    id: 2,
    title: "New Arrivals",
    imgUrl: "/assets/images/hero/hero-2.jpg",
    category: "Featured",
    buttonLink: "/products",
    description: "Explore new products and exclusive offers."
  }
];

const SERVICES_FALLBACK: Service[] = [
  { id: "1", icon: "Truck", title: "Fast Delivery", description: "Start from $10" },
  { id: "2", icon: "MoneyGuarantee", title: "Money Guarantee", description: "7 Days Back" },
  { id: "3", icon: "AlarmClock", title: "365 Days", description: "For free return" },
  { id: "4", icon: "Payment", title: "Payment", description: "Secure system" }
];

/** Base URL for server-side fetch (Next.js Data Cache requires absolute URLs). */
function getFetchBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  return getServerBaseUrl();
}

function logApiError(path: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[market-2] ${path}: ${message}`);
}

async function getApiArray<T>(path: string, fallback: T[] = []): Promise<T[]> {
  try {
    if (typeof window === "undefined") {
      const res = await fetch(`${getFetchBaseUrl()}${path}`, {
        next: { revalidate: CACHE_REVALIDATE_SECONDS }
      });

      if (!res.ok) return fallback;
      return (await res.json()) as T[];
    }

    const response = await axios.get<T[]>(path);
    return response.data;
  } catch (error) {
    logApiError(path, error);
    return fallback;
  }
}

const getProducts = cache(async (): Promise<Product[]> => {
  return getApiArray<Product>("/api/market-2/products");
});

const getFlashProducts = cache(async (): Promise<Product[]> => {
  return getApiArray<Product>("/api/market-2/flash-deals");
});

const getTopRatedProducts = cache(async (): Promise<Product[]> => {
  return getApiArray<Product>("/api/market-2/top-rated");
});

const getServices = cache(async (): Promise<Service[]> => {
  return getApiArray<Service>("/api/market-2/service", SERVICES_FALLBACK);
});

const getCategories = cache(async (): Promise<Category[]> => {
  return getApiArray<Category>("/api/market-2/categories");
});

const getBrands = cache(async (): Promise<Brand[]> => {
  return getApiArray<Brand>("/api/market-2/brand");
});

const getShops = cache(async (): Promise<Shop[]> => {
  return getApiArray<Shop>("/api/market-2/shops");
});

const getMainCarouselData = cache(async (): Promise<MainCarouselItem[]> => {
  return getApiArray<MainCarouselItem>("/api/market-2/main-carousel", MAIN_CAROUSEL_FALLBACK);
});

const getBlogs = cache(async (): Promise<Blog[]> => {
  return getApiArray<Blog>("/api/market-2/articles");
});

const getClients = cache(async (): Promise<Brand[]> => {
  return getApiArray<Brand>("/api/market-2/clients");
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
