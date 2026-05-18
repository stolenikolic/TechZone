import { adminPageMetadata } from "lib/site-metadata";
import { notFound } from "next/navigation";
import { OrderDetailsPageView } from "pages-sections/vendor-dashboard/orders/page-view";
import { getOrder } from "lib/orders/orders-service";
// CUSTOM DATA MODEL
import { IdParams } from "models/Common";

export const metadata = adminPageMetadata("Detalji narudžbe");

export default async function OrderDetails({ params }: IdParams) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) notFound();

  return <OrderDetailsPageView order={order} />;
}
