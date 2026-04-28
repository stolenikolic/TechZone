import { Metadata } from "next";
import { WishListPageView } from "pages-sections/customer-dashboard/wish-list";
// API FUNCTIONS
import { getWishListProducts } from "utils/__api__/wish-list";

export const metadata: Metadata = {
  title: "Wish List - Bazaar Next.js E-commerce Template",
  description: `Bazaar is a React Next.js E-commerce template. Build SEO friendly Online store, delivery app and Multi vendor store`,
  authors: [{ name: "UI-LIB", url: "https://ui-lib.com" }],
  keywords: ["e-commerce", "e-commerce template", "next.js", "react"]
};

// ==============================================================
interface Props {
  searchParams: Promise<{ page: string }>;
}
// ==============================================================

export default async function WishList({ searchParams }: Props) {
  const { page } = await searchParams;
  const data = await getWishListProducts(+page || 1);

  if (!data || data.products.length === 0) {
    return <div>Data not found</div>;
  }

  return <WishListPageView products={data.products} totalPages={data.totalPages} />;
}
