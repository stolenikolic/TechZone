import { shopPageMetadata } from "lib/site-metadata";
import { WishListPageView } from "pages-sections/customer-dashboard/wish-list";
// API FUNCTIONS
import { getWishListProducts } from "utils/__api__/wish-list";

export const metadata = shopPageMetadata("Lista želja");

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
