import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORY_IMAGES_BUCKET, PRODUCT_IMAGES_BUCKET } from "lib/images/constants";

const STORAGE_PUBLIC_SEGMENT = "/storage/v1/object/public/";

export function getStoragePublicUrl(supabase: SupabaseClient, bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Parse `products/{id}/0.webp` from a Supabase public object URL. */
export function storagePathFromPublicUrl(
  publicUrl: string,
  bucket: string
): string | null {
  try {
    const marker = `${STORAGE_PUBLIC_SEGMENT}${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    const path = publicUrl.slice(idx + marker.length).split("?")[0];
    return path || null;
  } catch {
    return null;
  }
}

export function isHostedProductImage(publicUrl: string, productId: string): boolean {
  const path = storagePathFromPublicUrl(publicUrl, PRODUCT_IMAGES_BUCKET);
  return path != null && path.startsWith(`${productId}/`);
}

export function isHostedCategoryImage(publicUrl: string, categoryId: string): boolean {
  const path = storagePathFromPublicUrl(publicUrl, CATEGORY_IMAGES_BUCKET);
  return path === `${categoryId}.webp` || path === `${categoryId}/cover.webp`;
}

export async function uploadWebp(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  buffer: Buffer
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: "image/webp",
    upsert: true
  });
  if (error) throw new Error(`Storage upload failed (${bucket}/${path}): ${error.message}`);
  return getStoragePublicUrl(supabase, bucket, path);
}

export async function removeStoragePaths(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<void> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(unique);
  if (error) {
    console.warn(`[images] remove ${bucket}:`, error.message);
  }
}

/** Remove all objects under `products/{productId}/`. */
export async function removeProductImageFolder(
  supabase: SupabaseClient,
  productId: string
): Promise<void> {
  const { data, error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).list(productId, {
    limit: 100
  });
  if (error) {
    console.warn(`[images] list products/${productId}:`, error.message);
    return;
  }
  const paths = (data ?? []).map((f) => `${productId}/${f.name}`);
  await removeStoragePaths(supabase, PRODUCT_IMAGES_BUCKET, paths);
}

export async function removeCategoryImage(
  supabase: SupabaseClient,
  categoryId: string,
  currentImageUrl: string | null | undefined
): Promise<void> {
  const paths: string[] = [`${categoryId}.webp`, `${categoryId}/cover.webp`];
  if (currentImageUrl) {
    const parsed = storagePathFromPublicUrl(currentImageUrl, CATEGORY_IMAGES_BUCKET);
    if (parsed) paths.push(parsed);
  }
  await removeStoragePaths(supabase, CATEGORY_IMAGES_BUCKET, paths);
}
