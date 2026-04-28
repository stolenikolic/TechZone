import { Metadata } from "next";
import { PaymentMethodsPageView } from "pages-sections/customer-dashboard/payment-methods/page-view";
// API FUNCTIONS
import api from "utils/__api__/payments";

export const metadata: Metadata = {
  title: "Payment Methods - Bazaar Next.js E-commerce Template",
  description: `Bazaar is a React Next.js E-commerce template. Build SEO friendly Online store, delivery app and Multi vendor store`,
  authors: [{ name: "UI-LIB", url: "https://ui-lib.com" }],
  keywords: ["e-commerce", "e-commerce template", "next.js", "react"]
};

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
