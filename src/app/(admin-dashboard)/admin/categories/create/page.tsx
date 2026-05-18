import { adminPageMetadata } from "lib/site-metadata";
import { CreateCategoryPageView } from "pages-sections/vendor-dashboard/categories/page-view";

export const metadata = adminPageMetadata("Nova kategorija");

export default function CreateCategory() {
  return <CreateCategoryPageView />;
}
