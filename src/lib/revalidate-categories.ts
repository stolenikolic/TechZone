import { revalidatePath, revalidateTag } from "next/cache";
import {
  categoryListingTagForId,
  categoryListingTagForPath
} from "lib/shop-category-listing";

export function revalidateCategorySurfaces(
  categorySlug?: string | null,
  categoryId?: string | null
): void {
  if (categorySlug) {
    revalidatePath(`/categories/${categorySlug}`);
    revalidateTag(categoryListingTagForPath(categorySlug), "max");
  }
  if (categoryId) {
    revalidateTag(categoryListingTagForId(categoryId), "max");
  }
  revalidatePath("/");
  revalidatePath("/categories", "layout");
  revalidatePath("/api/categories");
  revalidatePath("/api/market-2/categories");
  revalidateTag("market-2-categories", "max");
  revalidatePath("/api/search");
  revalidatePath("/api/market-2/products");
  revalidatePath("/api/market-2/flash-deals");
  revalidatePath("/api/market-2/top-rated");
}
