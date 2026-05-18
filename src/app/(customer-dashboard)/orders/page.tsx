import { shopPageMetadata } from "lib/site-metadata";
import { OrdersPageView } from "pages-sections/customer-dashboard/orders/page-view";
// API FUNCTIONS
import api from "utils/__api__/orders";

export const metadata = shopPageMetadata("Narudžbe");

// ==============================================================
interface Props {
  searchParams: Promise<{ page: string }>;
}
// ==============================================================

export default async function Orders({ searchParams }: Props) {
  const { page } = await searchParams;
  const data = await api.getOrders(+page || 1);

  if (!data || data.orders.length === 0) {
    return <div>Failed to load</div>;
  }

  return <OrdersPageView orders={data.orders} totalPages={data.totalPages} />;
}
