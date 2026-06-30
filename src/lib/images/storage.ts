import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATEGORY_IMAGES_BUCKET,
  HOMEPAGE_IMAGES_BUCKET,
  PRODUCT_IMAGES_BUCKET
} from "lib/images/constants";
import {
  deleteR2ObjectPaths,
  getR2PublicBaseUrl,
  getR2PublicUrl,
  listR2ObjectPaths,
  uploadR2Object
} from "lib/storage/r2";

const STORAGE_PUBLIC_SEGMENT = "/storage/v1/object/public/";

export function getStoragePublicUrl(_supabase: SupabaseClient, bucket: string, path: string): string {
  return getR2PublicUrl(bucket, path);
}

/** Parse object path from a hosted public URL (R2 or legacy Supabase). */
export function storagePathFromPublicUrl(publicUrl: string, bucket: string): string | null {
  try {
    const markers = [
      `${STORAGE_PUBLIC_SEGMENT}${bucket}/`,
      `${getR2PublicBaseUrl()}/${bucket}/`
    ];

    for (const marker of markers) {
      const idx = publicUrl.indexOf(marker);
      if (idx === -1) continue;
      const objectPath = publicUrl.slice(idx + marker.length).split("?")[0];
      return objectPath || null;
    }

    return null;
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
  if (!path) return false;
  if (path === `${categoryId}.webp` || path === `${categoryId}/cover.webp`) return true;
  return path.startsWith(`${categoryId}/`);
}

export function newCategoryImageStoragePath(categoryId: string): string {
  return `${categoryId}/${Date.now()}.webp`;
}

export function isHostedHomepageImage(publicUrl: string, blockId: string): boolean {
  const path = storagePathFromPublicUrl(publicUrl, HOMEPAGE_IMAGES_BUCKET);
  if (!path) return false;
  if (path === `${blockId}.webp`) return true;
  return path.startsWith(`${blockId}/`);
}

export function newHomepageImageStoragePath(blockId: string): string {
  return `${blockId}/${Date.now()}.webp`;
}

/** Remove legacy `{id}.webp` and all versioned files under `{id}/`. */
export async function removeHomepageImage(
  _supabase: SupabaseClient,
  blockId: string,
  currentImageUrl: string | null | undefined
): Promise<void> {
  const paths: string[] = [`${blockId}.webp`];

  if (currentImageUrl) {
    const parsed = storagePathFromPublicUrl(currentImageUrl, HOMEPAGE_IMAGES_BUCKET);
    if (parsed) paths.push(parsed);
  }

  const listed = await listR2ObjectPaths(HOMEPAGE_IMAGES_BUCKET, blockId);
  paths.push(...listed);

  await removeStoragePaths(_supabase, HOMEPAGE_IMAGES_BUCKET, paths);
}

export async function uploadWebp(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  buffer: Buffer
): Promise<string> {
  try {
    await uploadR2Object(bucket, path, buffer, "image/webp");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Storage upload failed (${bucket}/${path}): ${message}`);
  }
  return getStoragePublicUrl(supabase, bucket, path);
}

export async function removeStoragePaths(
  _supabase: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<void> {
  await deleteR2ObjectPaths(bucket, paths);
}

/** Remove all objects under `products/{productId}/`. */
export async function removeProductImageFolder(
  _supabase: SupabaseClient,
  productId: string
): Promise<void> {
  const paths = await listR2ObjectPaths(PRODUCT_IMAGES_BUCKET, productId);
  await removeStoragePaths(_supabase, PRODUCT_IMAGES_BUCKET, paths);
}

export async function removeCategoryImage(
  _supabase: SupabaseClient,
  categoryId: string,
  currentImageUrl: string | null | undefined
): Promise<void> {
  const paths: string[] = [`${categoryId}.webp`, `${categoryId}/cover.webp`];
  if (currentImageUrl) {
    const parsed = storagePathFromPublicUrl(currentImageUrl, CATEGORY_IMAGES_BUCKET);
    if (parsed) paths.push(parsed);
  }

  const listed = await listR2ObjectPaths(CATEGORY_IMAGES_BUCKET, categoryId);
  paths.push(...listed);

  await removeStoragePaths(_supabase, CATEGORY_IMAGES_BUCKET, paths);
}
