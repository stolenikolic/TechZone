import { adminPageMetadata } from "lib/site-metadata";
import { SupplierOffersPageView } from "pages-sections/vendor-dashboard/products/page-view";
import api from "utils/__api__/dashboard";

export const metadata = adminPageMetadata("Ponude dobavljača");

export default async function SupplierOffersPage() {
  const offers = await api.supplierOffers();
  return <SupplierOffersPageView offers={offers} />;
}
