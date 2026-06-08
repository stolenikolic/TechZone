import { adminPageMetadata } from "lib/site-metadata";
import { ProductsPageView } from "pages-sections/vendor-dashboard/products/page-view";

export const metadata = adminPageMetadata("Proizvodi");

export default function Products() {
  return <ProductsPageView />;
}
