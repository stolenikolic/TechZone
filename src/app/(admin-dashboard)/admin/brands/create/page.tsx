import { adminPageMetadata } from "lib/site-metadata";
import { CreateBrandPageView } from "pages-sections/vendor-dashboard/brands/page-view";

export const metadata = adminPageMetadata("Novi brend");

export default function BrandCreate() {
  return <CreateBrandPageView />;
}
