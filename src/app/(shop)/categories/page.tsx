import { shopPageMetadata } from "lib/site-metadata";
import { SiteBreadcrumbs } from "components/site-breadcrumbs";
import CategoryBrowser, { type CategoryTreeNode } from "pages-sections/categories";
import api from "utils/__api__/market-2";

export const metadata = shopPageMetadata(
  "Kategorije",
  "Pregled svih glavnih kategorija na Tech Zone online prodavnici."
);

export default async function CategoriesPage() {
  const categories = (await api.getCategories()) as unknown as CategoryTreeNode[];

  return (
    <div className="bg-white pt-2 pb-4">
      <CategoryBrowser
        breadcrumbs={<SiteBreadcrumbs items={[{ label: "Kategorije" }]} />}
        categories={categories}
        title="Kategorije"
        description="Izaberi glavnu kategoriju da vidiš dostupne podkategorije."
      />
    </div>
  );
}
