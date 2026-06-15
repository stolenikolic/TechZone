import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_IMAGES_BUCKET } from "lib/images/constants";
import { fetchImageBuffer } from "lib/images/fetch-image";
import { resizeProductToWebp } from "lib/images/resize-to-webp";
import { removeProductImageFolder, removeStoragePaths, storagePathFromPublicUrl, uploadWebp } from "lib/images/storage";

export type ProcessProductImagesOptions = {
  /** When false (import default), skip if product_images already exist. */
  replaceExisting?: boolean;
};

/**
 * Supplier import: fetch URLs → WebP → Storage → product_images.
 * Skips when rows already exist unless replaceExisting is true.
 */
export async function processProductImages(
  supabase: SupabaseClient,
  productId: string,
  imageUrls: string[],
  options?: ProcessProductImagesOptions
): Promise<string[]> {
  if (!imageUrls.length) return [];

  const replaceExisting = options?.replaceExisting ?? false;

  if (replaceExisting) {
    const { data: existingRows } = await supabase
      .from("product_images")
      .select("image_url")
      .eq("product_id", productId);

    const legacyPaths = (existingRows ?? [])
      .map((row) => storagePathFromPublicUrl(String(row.image_url), PRODUCT_IMAGES_BUCKET))
      .filter((p): p is string => Boolean(p));

    await removeProductImageFolder(supabase, productId);
    if (legacyPaths.length > 0) {
      await removeStoragePaths(supabase, PRODUCT_IMAGES_BUCKET, legacyPaths);
    }
    await supabase.from("product_images").delete().eq("product_id", productId);
  } else {
    const { data: existing } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", productId)
      .limit(1);

    if (existing && existing.length > 0) {
      const { data: existingRows } = await supabase
        .from("product_images")
        .select("image_url")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true });
      return (existingRows ?? [])
        .map((row) => row.image_url)
        .filter((url): url is string => typeof url === "string");
    }
  }

  const rows: { product_id: string; image_url: string; sort_order: number }[] = [];

  for (let index = 0; index < imageUrls.length; index++) {
    const url = imageUrls[index];
    if (!url || typeof url !== "string") continue;

    try {
      const buffer = await fetchImageBuffer(url);
      const webpBuffer = await resizeProductToWebp(buffer);
      const path = `${productId}/${index}.webp`;
      const publicUrl = await uploadWebp(supabase, PRODUCT_IMAGES_BUCKET, path, webpBuffer);
      rows.push({
        product_id: productId,
        image_url: publicUrl,
        sort_order: index
      });
    } catch (err) {
      console.error(`[images] product ${productId} image ${index} (${url}):`, err);
    }
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("product_images").insert(rows);
    if (insertError) {
      console.error(`[images] product_images insert ${productId}:`, insertError.message);
    }
  }

  return rows.map((row) => row.image_url);
}
