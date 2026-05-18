import { shopPageMetadata } from "lib/site-metadata";
import { OrdersPageView } from "pages-sections/customer-dashboard/orders/page-view";
import { getAuthUser } from "lib/auth/session";
import { getOrdersForUser } from "lib/auth/customer-orders";

export const metadata = shopPageMetadata("Narudžbe");

interface Props {
  searchParams: Promise<{ page: string }>;
}

export default async function Orders({ searchParams }: Props) {
  const { page } = await searchParams;
  const user = await getAuthUser();
  if (!user) return null;

  const pageNum = Math.max(1, Number(page) || 1);

  try {
    const data = await getOrdersForUser(user.id, pageNum);

    if (!data.orders.length) {
      return <OrdersPageView orders={[]} totalPages={1} />;
    }

    return <OrdersPageView orders={data.orders} totalPages={data.totalPages} />;
  } catch {
    return <p>Narudžbe trenutno nisu dostupne.</p>;
  }
}
