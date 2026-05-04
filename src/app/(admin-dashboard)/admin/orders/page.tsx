import { Metadata } from "next";
import { OrdersPageView } from "pages-sections/vendor-dashboard/orders/page-view";
import { getOrders } from "lib/orders/orders-service";

export const metadata: Metadata = {
  title: "Orders - Bazaar Next.js E-commerce Template",
  description: `Bazaar is a React Next.js E-commerce template. Build SEO friendly Online store, delivery app and Multi vendor store`,
  authors: [{ name: "UI-LIB", url: "https://ui-lib.com" }],
  keywords: ["e-commerce", "e-commerce template", "next.js", "react"]
};

export default async function Orders() {
  const orders = await getOrders();
  return <OrdersPageView orders={orders} />;
}
