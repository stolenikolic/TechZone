import { adminPageMetadata } from "lib/site-metadata";
import { OrdersPageView } from "pages-sections/vendor-dashboard/orders/page-view";
import { getOrders } from "lib/orders/orders-service";

export const metadata = adminPageMetadata("Narudžbe");

export default async function Orders() {
  const orders = await getOrders();
  return <OrdersPageView orders={orders} />;
}
