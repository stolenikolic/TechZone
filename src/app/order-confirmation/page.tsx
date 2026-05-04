import type { Metadata } from "next";
import { OrderConfirmationPageView } from "pages-sections/order-confirmation";
import { getOrder } from "lib/orders/orders-service";

export const metadata: Metadata = {
  title: "Order Confirmation - Bazaar Next.js E-commerce Template",
  description:
    "Bazaar is a React Next.js E-commerce template. Build SEO friendly Online store, delivery app and Multi vendor store",
  authors: [{ name: "UI-LIB", url: "https://ui-lib.com" }],
  keywords: ["e-commerce", "e-commerce template", "next.js", "react"]
};

type Props = {
  searchParams: Promise<{ orderId?: string }>;
};

export default async function OrderConfirmation({ searchParams }: Props) {
  const { orderId } = await searchParams;
  const order = orderId ? await getOrder(orderId) : null;

  return <OrderConfirmationPageView orderId={order?.id ?? orderId} />;
}
