import { Metadata } from "next";
import { dynamicShopMetadata } from "lib/site-metadata";
import { notFound } from "next/navigation";
import { OrderDetailsPageView } from "pages-sections/customer-dashboard/orders/page-view";
import { getAuthUser } from "lib/auth/session";
import { getOrderForUser } from "lib/auth/customer-orders";
import { IdParams } from "models/Common";

export async function generateMetadata({ params }: IdParams): Promise<Metadata> {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return dynamicShopMetadata("Narudžba");

  const order = await getOrderForUser(user.id, id);
  if (!order) notFound();

  return dynamicShopMetadata(String(order.id));
}

export default async function OrderDetails({ params }: IdParams) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return null;

  const order = await getOrderForUser(user.id, id);
  if (!order) notFound();

  return <OrderDetailsPageView order={order} />;
}
