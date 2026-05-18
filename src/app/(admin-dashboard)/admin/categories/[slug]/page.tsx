import { adminPageMetadata } from "lib/site-metadata";
import { EditCategoryPageView } from "pages-sections/vendor-dashboard/categories/page-view";

export const metadata = adminPageMetadata("Uredi kategoriju");

export default function EditCategory() {
  return <EditCategoryPageView />;
}
