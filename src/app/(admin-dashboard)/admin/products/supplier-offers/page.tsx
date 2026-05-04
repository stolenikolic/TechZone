import type { Metadata } from "next";
import { SupplierOffersPageView } from "pages-sections/vendor-dashboard/products/page-view";
import api from "utils/__api__/dashboard";

export const metadata: Metadata = {
  title: "Supplier Offers - Tech Zone Admin"
};

export default async function SupplierOffersPage() {
  const offers = await api.supplierOffers();
  return <SupplierOffersPageView offers={offers} />;
}
