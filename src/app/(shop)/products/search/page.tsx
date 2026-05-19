import { shopPageMetadata } from "lib/site-metadata";
// PAGE VIEW COMPONENT
import { ProductSearchPageView } from "pages-sections/product-details/page-view";
// API FUNCTIONS
import { getSearchPageData } from "utils/__api__/product-search";

export const metadata = shopPageMetadata(
  "Pretraga proizvoda",
  "Pretražite računarsku opremu i komponente na Tech Zone."
);

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

  const data = await getSearchPageData({ q, page, sort, sale, prices, colors, brands, rating, category });

  return (
    <ProductSearchPageView
      filters={data.filters}
      products={data.products}
      pageCount={data.pageCount}
      totalProducts={data.totalProducts}
      lastIndex={data.lastIndex}
      firstIndex={data.firstIndex}
    />
  );
}
