import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "products";
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 85;

/**
 * Download image from URL and return buffer. Uses same User-Agent as IPON fetch.
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      Accept: "image/*"
    },
    next: { revalidate: 0 }
  });
  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status} ${res.statusText} for ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Resize (max width 1200px) and convert to WEBP at ~85 quality.
 */
async function processImageBuffer(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

/**
 * If product already has images in product_images, skip download/upload.
 * Otherwise: for each image URL → fetch → resize → webp → upload to Supabase Storage → insert product_images.
 * Path: products/{product_id}/{index}.webp
 */
export async function processProductImages(
  supabase: SupabaseClient,
  productId: string,
  imageUrls: string[]
): Promise<string[]> {
  if (!imageUrls.length) return [];

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
    return (existingRows ?? []).map((row) => row.image_url).filter((url): url is string => typeof url === "string");
  }

  const rows: { product_id: string; image_url: string; sort_order: number }[] = [];

  for (let index = 0; index < imageUrls.length; index++) {
    const url = imageUrls[index];
    if (!url || typeof url !== "string") continue;

    try {
      const buffer = await fetchImageBuffer(url);
      const webpBuffer = await processImageBuffer(buffer);
      const path = `${productId}/${index}.webp`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, webpBuffer, {
          contentType: "image/webp",
          upsert: true
        });

      if (uploadError) {
        console.error(`[IPON images] Upload failed for product ${productId} image ${index}:`, uploadError.message);
        continue;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      rows.push({
        product_id: productId,
        image_url: urlData.publicUrl,
        sort_order: index
      });
    } catch (err) {
      console.error(`[IPON images] Process failed for product ${productId} image ${index} (${url}):`, err);
    }
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("product_images").insert(rows);
    if (insertError) {
      console.error(`[IPON images] product_images insert failed for product ${productId}:`, insertError.message);
    }
  }

  return rows.map((row) => row.image_url);
}
