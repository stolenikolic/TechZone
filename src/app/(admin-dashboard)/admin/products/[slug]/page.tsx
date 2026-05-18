import { adminPageMetadata } from "lib/site-metadata";
import { EditProductPageView } from "pages-sections/vendor-dashboard/products/page-view";

export const metadata = adminPageMetadata("Uredi proizvod");

export default function ProductEdit() {
  return <EditProductPageView />;
}
