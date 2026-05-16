import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORY_IMAGES_BUCKET } from "lib/images/constants";
import { fetchImageBuffer } from "lib/images/fetch-image";
import { resizeCategoryToWebp } from "lib/images/resize-to-webp";
import { isHostedCategoryImage, removeCategoryImage, uploadWebp } from "lib/images/storage";

async function uploadCategoryWebp(
  supabase: SupabaseClient,
  categoryId: string,
  input: Buffer
): Promise<string> {
  const webpBuffer = await resizeCategoryToWebp(input);
  const path = `${categoryId}.webp`;
  return uploadWebp(supabase, CATEGORY_IMAGES_BUCKET, path, webpBuffer);
}

/**
 * Process remote URL or file buffer → Storage → return public URL for categories.image_url.
 */
export async function processCategoryImageFromUrl(
  supabase: SupabaseClient,
  categoryId: string,
  imageUrl: string,
  currentImageUrl: string | null | undefined
): Promise<string | null> {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  if (isHostedCategoryImage(trimmed, categoryId)) {
    return trimmed;
  }

  await removeCategoryImage(supabase, categoryId, currentImageUrl);
  const buffer = await fetchImageBuffer(trimmed);
  return uploadCategoryWebp(supabase, categoryId, buffer);
}

export async function processCategoryImageFromBuffer(
  supabase: SupabaseClient,
  categoryId: string,
  input: Buffer,
  currentImageUrl: string | null | undefined
): Promise<string> {
  await removeCategoryImage(supabase, categoryId, currentImageUrl);
  return uploadCategoryWebp(supabase, categoryId, input);
}
