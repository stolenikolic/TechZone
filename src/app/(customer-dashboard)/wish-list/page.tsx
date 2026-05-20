import { shopPageMetadata } from "lib/site-metadata";
import WishListPageClient from "pages-sections/customer-dashboard/wish-list/wish-list-page-client";

export const metadata = shopPageMetadata("Lista želja");

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function WishList({ searchParams }: Props) {
  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);

  return <WishListPageClient page={pageNum} />;
}
