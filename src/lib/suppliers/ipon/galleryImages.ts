/**
 * Extra iPon gallery images. The feed image stays main_image.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { processProductImages } from "lib/images/process-product-images";
import { IPON_SUPPLIER_ID } from "./constants";
import { galleryUrlsExcludingMain } from "./icdnImages";

export { extractIcdnImageUrls, galleryUrlsExcludingMain } from "./icdnImages";

export async function ingestIponGalleryImages(
  supabase: SupabaseClient,
  productId: string,
  supplierProductId: string,
  imageUrls: string[],
  raw: unknown
): Promise<number> {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (typeof record.gallery_ingested_at === "string" && record.gallery_ingested_at) return 0;

  const pictures = Array.isArray(record.pictures) ? record.pictures : [];
  const main = typeof pictures[0] === "string" ? pictures[0] : null;
  const extra = galleryUrlsExcludingMain(imageUrls, main);
  if (extra.length === 0) {
    await markGalleryIngested(supabase, supplierProductId, record);
    return 0;
  }

  const hosted = await processProductImages(supabase, productId, extra, { append: true });
  if (hosted.length === 0) return 0;
  await markGalleryIngested(supabase, supplierProductId, record);
  return hosted.length;
}

async function markGalleryIngested(
  supabase: SupabaseClient,
  supplierProductId: string,
  raw: Record<string, unknown>
): Promise<void> {
  const merged = { ...raw, gallery_ingested_at: new Date().toISOString() };
  const { error } = await supabase
    .from("supplier_products")
    .update({ raw_json: merged, updated_at: new Date().toISOString() })
    .eq("supplier_id", IPON_SUPPLIER_ID)
    .eq("supplier_product_id", supplierProductId);
  if (error) {
    console.warn("[iPon scrape] gallery marker:", error.message);
  }
}
