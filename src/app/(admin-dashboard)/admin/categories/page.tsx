import { adminPageMetadata } from "lib/site-metadata";
import { CategoriesPageView } from "pages-sections/vendor-dashboard/categories/page-view";
// API FUNCTIONS
import api from "utils/__api__/dashboard";

export const metadata = adminPageMetadata("Kategorije");

export default async function Categories() {
  const categories = await api.category();
  return <CategoriesPageView categories={categories} />;
}
