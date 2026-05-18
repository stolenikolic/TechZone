import { shopPageMetadata } from "lib/site-metadata";
import { notFound } from "next/navigation";
import { PaymentDetailsPageView } from "pages-sections/customer-dashboard/payment-methods/page-view";
// API FUNCTIONS
import api from "utils/__api__/payments";
// TYPES
import { IdParams } from "models/Common";

export const metadata = shopPageMetadata("Detalji plaćanja");

export default async function PaymentMethodDetails({ params }: IdParams) {
  const { id } = await params;
  const payment = await api.getPayment(id);

  if (!payment) notFound();

  return <PaymentDetailsPageView payment={payment} />;
}
