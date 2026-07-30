import { revalidatePath, revalidateTag } from "next/cache";
import {
  categoryListingTagForId,
  categoryListingTagForPath
} from "lib/shop-category-listing";
import { SEARCH_RESULTS_CACHE_TAG } from "lib/search/resolve-search-results";

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
  revalidatePath("/api/homepage/categories");
  revalidateTag("homepage-categories", "max");
  revalidatePath("/api/search");
  revalidateTag(SEARCH_RESULTS_CACHE_TAG, "max");
  revalidatePath("/api/homepage/products");
  revalidatePath("/api/homepage/flash-deals");
  revalidatePath("/api/homepage/top-rated");
}
