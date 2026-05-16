import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_IMAGES_BUCKET } from "lib/images/constants";
import { fetchImageBuffer } from "lib/images/fetch-image";
import { resizeProductToWebp } from "lib/images/resize-to-webp";
import {
  isHostedProductImage,
  removeStoragePaths,
  storagePathFromPublicUrl,
  uploadWebp
} from "lib/images/storage";

function uniqueOrderedUrls(mainImage: string | null | undefined, imageUrls: string[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string | null | undefined) => {
    const url = raw?.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    ordered.push(url);
  };

  add(mainImage);
  for (const url of imageUrls) add(url);
  return ordered;
}

function sameUrlMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const url of a) counts.set(url, (counts.get(url) ?? 0) + 1);
  for (const url of b) {
    const n = counts.get(url);
    if (!n) return false;
    if (n === 1) counts.delete(url);
    else counts.set(url, n - 1);
  }
  return counts.size === 0;
}

async function ingestToPath(
  supabase: SupabaseClient,
  productId: string,
  sourceUrl: string,
  index: number
): Promise<string | null> {
  try {
    const buffer = await fetchImageBuffer(sourceUrl);
    const webpBuffer = await resizeProductToWebp(buffer);
    const path = `${productId}/${index}.webp`;
    return await uploadWebp(supabase, PRODUCT_IMAGES_BUCKET, path, webpBuffer);
  } catch (err) {
    console.error(`[images] admin ingest ${productId} #${index}:`, err);
    return null;
  }
}

/**
 * Admin save: process external URLs on next save; reorder-only when all URLs are already hosted.
 */
export async function syncAdminProductImages(
  supabase: SupabaseClient,
  productId: string,
  input: { mainImage?: string | null; imageUrls?: string[] }
): Promise<{ mainImage: string | null; imageUrls: string[] }> {
  const ordered = uniqueOrderedUrls(input.mainImage, input.imageUrls ?? []);

  const { data: existingRows } = await supabase
    .from("product_images")
    .select("image_url")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  const existingUrls = (existingRows ?? []).map((r) => String(r.image_url));

  if (ordered.length === 0) {
    const pathsToRemove = existingUrls
      .map((url) => storagePathFromPublicUrl(url, PRODUCT_IMAGES_BUCKET))
      .filter((p): p is string => Boolean(p));
    await removeStoragePaths(supabase, PRODUCT_IMAGES_BUCKET, pathsToRemove);
    await supabase.from("product_images").delete().eq("product_id", productId);
    await supabase.from("products").update({ main_image: null }).eq("id", productId);
    return { mainImage: null, imageUrls: [] };
  }

  const onlyReorder =
    ordered.every((url) => isHostedProductImage(url, productId)) &&
    sameUrlMultiset(ordered, existingUrls);

  if (onlyReorder) {
    await supabase.from("product_images").delete().eq("product_id", productId);
    await supabase.from("product_images").insert(
      ordered.map((image_url, sort_order) => ({
        product_id: productId,
        image_url,
        sort_order
      }))
    );
    const mainImage = input.mainImage?.trim() || ordered[0] || null;
    await supabase.from("products").update({ main_image: mainImage }).eq("id", productId);
    return { mainImage, imageUrls: ordered };
  }

  const finalUrls: string[] = [];
  for (let index = 0; index < ordered.length; index++) {
    const source = ordered[index];
    const expectedPath = `${productId}/${index}.webp`;
    const sourcePath = storagePathFromPublicUrl(source, PRODUCT_IMAGES_BUCKET);

    if (sourcePath === expectedPath) {
      finalUrls.push(source);
      continue;
    }

    const uploaded = await ingestToPath(supabase, productId, source, index);
    if (uploaded) finalUrls.push(uploaded);
  }

  const finalPaths = new Set(
    finalUrls
      .map((url) => storagePathFromPublicUrl(url, PRODUCT_IMAGES_BUCKET))
      .filter((p): p is string => Boolean(p))
  );

  const pathsToRemove = existingUrls
    .map((url) => storagePathFromPublicUrl(url, PRODUCT_IMAGES_BUCKET))
    .filter((p): p is string => {
      if (!p) return false;
      return !finalPaths.has(p);
    });

  await removeStoragePaths(supabase, PRODUCT_IMAGES_BUCKET, pathsToRemove);

  await supabase.from("product_images").delete().eq("product_id", productId);
  if (finalUrls.length > 0) {
    await supabase.from("product_images").insert(
      finalUrls.map((image_url, sort_order) => ({
        product_id: productId,
        image_url,
        sort_order
      }))
    );
  }

  const mainImage = input.mainImage?.trim() || finalUrls[0] || null;
  await supabase.from("products").update({ main_image: mainImage }).eq("id", productId);
  return { mainImage, imageUrls: finalUrls };
}
