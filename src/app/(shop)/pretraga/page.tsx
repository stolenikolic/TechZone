import type { Metadata } from "next";
import { siteLogoOgImage } from "lib/og-image-url";
import { ogPageTitle, pageTitle, SITE_KEYWORDS } from "lib/site-metadata";
// PAGE VIEW COMPONENT
import { ProductSearchPageView } from "pages-sections/product-details/page-view";
// API FUNCTIONS
import { getSearchPageData } from "utils/__api__/product-search";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  sale?: string;
  page?: string;
  sort?: string;
  prices?: string;
  colors?: string;
  brands?: string;
  rating?: string;
  category?: string;
};

interface Props {
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const pageNum = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);

  const titlePage = query
    ? pageNum > 1
      ? `Pretraga: ${query} – Strana ${pageNum}`
      : `Pretraga: ${query}`
    : pageNum > 1
      ? `Pretraga proizvoda – Strana ${pageNum}`
      : "Pretraga proizvoda";

  const title = pageTitle(titlePage, "shop");
  const ogTitle = ogPageTitle(titlePage);

  const description = query
    ? `Rezultati pretrage za „${query}” na Tech Zone online prodavnici.`
    : "Pretražite računarsku opremu i komponente na Tech Zone.";

  const logo = siteLogoOgImage();
  return {
    title,
    description,
    keywords: SITE_KEYWORDS,
    openGraph: {
      title: ogTitle,
      description,
      type: "website",
      images: [logo]
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [logo.url]
    }
  };
}

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
