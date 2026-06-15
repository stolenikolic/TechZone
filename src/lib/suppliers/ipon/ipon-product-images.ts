/**
 * iPon product image ingest — raw_json pictures → product_images + Storage.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { processProductImages } from "lib/images/process-product-images";
import { IPON_SUPPLIER_ID } from "./categories";
import type { IponProductItem } from "./transformProduct";

export const PICTURES_INGESTED_FROM_KEY = "pictures_ingested_from";

export function getPictureUrlsFromRawJson(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const pictures = (raw as Record<string, unknown>).pictures;
  if (!Array.isArray(pictures)) return [];
  return pictures.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}

export function getPicturesIngestedFrom(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const v = (raw as Record<string, unknown>)[PICTURES_INGESTED_FROM_KEY];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** True when hosted images were never recorded or source URL changed. */
export function needsPicturesIngest(raw: unknown, sourceFirstPicture: string | null): boolean {
  if (!sourceFirstPicture) return false;
  const ingested = getPicturesIngestedFrom(raw);
  if (!ingested) return true;
  return ingested !== sourceFirstPicture;
}

export function getFirstPictureUrl(item: IponProductItem | Record<string, unknown> | null | undefined): string | null {
  const urls = getPictureUrlsFromRawJson(item);
  return urls[0] ?? null;
}

/**
 * Download iPon URLs → WebP → Storage, replace product_images, update main_image.
 * Sets pictures_ingested_from on supplier_products.raw_json when supplierProductId given.
 */
export async function reingestIponProductImages(
  supabase: SupabaseClient,
  productId: string,
  pictureUrls: string[],
  options?: {
    supplierProductId?: string;
    existingRaw?: Record<string, unknown> | null;
    updateIngestedMarker?: boolean;
  }
): Promise<{ ok: boolean; hostedUrls: string[] }> {
  if (pictureUrls.length === 0) return { ok: false, hostedUrls: [] };

  const hostedUrls = await processProductImages(supabase, productId, pictureUrls, {
    replaceExisting: true
  });

  if (hostedUrls.length === 0) return { ok: false, hostedUrls: [] };

  const mainImage = hostedUrls[0] ?? null;
  if (mainImage) {
    await supabase.from("products").update({ main_image: mainImage }).eq("id", productId);
  }

  const supplierProductId = options?.supplierProductId;
  if (supplierProductId && options?.updateIngestedMarker !== false) {
    const mergedRaw: Record<string, unknown> = {
      ...(options.existingRaw ?? {}),
      [PICTURES_INGESTED_FROM_KEY]: pictureUrls[0]
    };
    await supabase
      .from("supplier_products")
      .update({
        raw_json: mergedRaw,
        updated_at: new Date().toISOString()
      })
      .eq("supplier_id", IPON_SUPPLIER_ID)
      .eq("supplier_product_id", supplierProductId);
  }

  return { ok: true, hostedUrls };
}
