import { adminPageMetadata } from "lib/site-metadata";
import { ProductCreatePageView } from "pages-sections/vendor-dashboard/products/page-view";

export const metadata = adminPageMetadata("Novi proizvod");

export default function ProductCreate() {
  return <ProductCreatePageView />;
}
