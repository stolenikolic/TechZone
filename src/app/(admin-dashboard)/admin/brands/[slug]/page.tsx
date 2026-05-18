import { adminPageMetadata } from "lib/site-metadata";
import { EditBrandPageView } from "pages-sections/vendor-dashboard/brands/page-view";

export const metadata = adminPageMetadata("Uredi brend");

export default function BrandEdit() {
  return <EditBrandPageView />;
}
