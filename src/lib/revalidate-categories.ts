import { revalidatePath } from "next/cache";

export function revalidateCategorySurfaces(categorySlug?: string | null): void {
  if (categorySlug) {
    revalidatePath(`/categories/${categorySlug}`);
  }
  revalidatePath("/categories", "layout");
  revalidatePath("/api/categories");
  revalidatePath("/api/search");
  revalidatePath("/api/market-2/products");
  revalidatePath("/api/market-2/flash-deals");
  revalidatePath("/api/market-2/top-rated");
}
