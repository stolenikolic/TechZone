import { shopPageMetadata } from "lib/site-metadata";
import { OrderConfirmationPageView } from "pages-sections/order-confirmation";
import { getOrder } from "lib/orders/orders-service";

export const metadata = shopPageMetadata("Potvrda narudžbe");

type Props = {
  searchParams: Promise<{ orderId?: string }>;
};

export default async function OrderConfirmation({ searchParams }: Props) {
  const { orderId } = await searchParams;
  const order = orderId ? await getOrder(orderId) : null;

  return <OrderConfirmationPageView orderId={order?.id ?? orderId} />;
}
