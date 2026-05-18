import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomepageZone } from "lib/homepage/zones";
import {
  HOMEPAGE_HERO_MAX_WIDTH,
  HOMEPAGE_IMAGES_BUCKET,
  HOMEPAGE_PROMO_MAX_WIDTH,
  HOMEPAGE_SIDE_MAX_WIDTH
} from "lib/images/constants";
import { fetchImageBuffer } from "lib/images/fetch-image";
import { resizeToWebp } from "lib/images/resize-to-webp";
import {
  isHostedHomepageImage,
  newHomepageImageStoragePath,
  removeHomepageImage,
  uploadWebp
} from "lib/images/storage";

function maxWidthForZone(zone: HomepageZone): number {
  switch (zone) {
    case "hero_carousel":
      return HOMEPAGE_HERO_MAX_WIDTH;
    case "hero_side":
      return HOMEPAGE_SIDE_MAX_WIDTH;
    case "promo":
      return HOMEPAGE_PROMO_MAX_WIDTH;
    default:
      return HOMEPAGE_HERO_MAX_WIDTH;
  }
}

async function uploadHomepageWebp(
  supabase: SupabaseClient,
  blockId: string,
  zone: HomepageZone,
  input: Buffer,
  currentImageUrl: string | null | undefined
): Promise<string> {
  await removeHomepageImage(supabase, blockId, currentImageUrl);
  const webpBuffer = await resizeToWebp(input, maxWidthForZone(zone));
  const path = newHomepageImageStoragePath(blockId);
  return uploadWebp(supabase, HOMEPAGE_IMAGES_BUCKET, path, webpBuffer);
}

export async function processHomepageImageFromUrl(
  supabase: SupabaseClient,
  blockId: string,
  zone: HomepageZone,
  imageUrl: string,
  currentImageUrl: string | null | undefined
): Promise<string | null> {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  if (isHostedHomepageImage(trimmed, blockId)) {
    return trimmed;
  }

  const buffer = await fetchImageBuffer(trimmed);
  return uploadHomepageWebp(supabase, blockId, zone, buffer, currentImageUrl);
}

export async function processHomepageImageFromBuffer(
  supabase: SupabaseClient,
  blockId: string,
  zone: HomepageZone,
  input: Buffer,
  currentImageUrl: string | null | undefined
): Promise<string> {
  return uploadHomepageWebp(supabase, blockId, zone, input, currentImageUrl);
}
