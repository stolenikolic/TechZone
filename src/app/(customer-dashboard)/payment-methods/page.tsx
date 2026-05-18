import { shopPageMetadata } from "lib/site-metadata";
import { PaymentMethodsPageView } from "pages-sections/customer-dashboard/payment-methods/page-view";
// API FUNCTIONS
import api from "utils/__api__/payments";

export const metadata = shopPageMetadata("Načini plaćanja");

// ==============================================================
interface Props {
  searchParams: Promise<{ page: string }>;
}
// ==============================================================

export default async function PaymentMethods({ searchParams }: Props) {
  const { page } = await searchParams;
  const data = await api.getPayments(+page || 1);

  if (!data || data.payments.length === 0) {
    return <div>Data not found</div>;
  }

  return <PaymentMethodsPageView payments={data.payments} totalPages={data.totalPages} />;
}
