import type { Metadata } from "next";
import CategoryBrowser, { type CategoryTreeNode } from "pages-sections/categories";
import api from "utils/__api__/market-2";

export const metadata: Metadata = {
  title: "Kategorije - Tech Zone",
  description: "Pregled svih glavnih kategorija na Tech Zone prodavnici."
};

export default async function CategoriesPage() {
  const categories = (await api.getCategories()) as unknown as CategoryTreeNode[];

  return (
    <div className="bg-white pt-2 pb-4">
      <CategoryBrowser
        categories={categories}
        title="Kategorije"
        description="Izaberi glavnu kategoriju da vidiš dostupne podkategorije."
      />
    </div>
  );
}
