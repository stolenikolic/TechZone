import { adminPageMetadata } from "lib/site-metadata";
import { SupplierOffersPageView } from "pages-sections/vendor-dashboard/products/page-view";

export const metadata = adminPageMetadata("Ponude dobavljača");

export default function SupplierOffersPage() {
  return <SupplierOffersPageView />;
}
