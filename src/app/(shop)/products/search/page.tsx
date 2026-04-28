import { Metadata } from "next";
// PAGE VIEW COMPONENT
import { ProductSearchPageView } from "pages-sections/product-details/page-view";
// API FUNCTIONS
import { getFilters, getProducts } from "utils/__api__/product-search";

export const metadata: Metadata = {
  title: "Search Products – Tech Zone",
  description: "Search tech hardware and components at Tech Zone.",
  keywords: ["search", "tech", "hardware", "e-commerce"]
};

export const dynamic = "force-dynamic";

// ==============================================================
interface Props {
  searchParams: Promise<{
    q: string;
    sale: string;
    page: string;
    sort: string;
    prices: string;
    colors: string;
    brands: string;
    rating: string;
    category: string;
  }>;
}
// ==============================================================

export default async function ProductSearch({ searchParams }: Props) {
  const { q, page, sort, sale, prices, colors, brands, rating, category } = await searchParams;

  const [filters, data] = await Promise.all([
    getFilters(),
    getProducts({ q, page, sort, sale, prices, colors, brands, rating, category })
  ]);

  return (
    <ProductSearchPageView
      filters={filters}
      products={data.products}
      pageCount={data.pageCount}
      totalProducts={data.totalProducts}
      lastIndex={data.lastIndex}
      firstIndex={data.firstIndex}
    />
  );
}
