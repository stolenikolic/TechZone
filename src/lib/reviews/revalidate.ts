import { revalidatePath, revalidateTag } from "next/cache";
import { categoryListingTagForId } from "lib/shop-category-listing";
import { createSupabaseServiceClient } from "utils/supabase";
import { productDetailTag, productReviewsTag } from "./tags";

export async function revalidateReviewSurfaces(productId: string) {
  const service = createSupabaseServiceClient();
  const { data: product } = await service
    .from("products")
    .select("slug, category_id")
    .eq("id", productId)
    .maybeSingle();

  revalidateTag(productReviewsTag(productId), "max");
  if (product?.slug) {
    revalidateTag(productDetailTag(product.slug), "max");
    revalidatePath(`/proizvodi/${product.slug}`);
  }
  if (product?.category_id) {
    revalidateTag(categoryListingTagForId(product.category_id), "max");
  }
  revalidatePath("/admin/products/reviews");
}
