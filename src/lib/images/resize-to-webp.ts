import sharp from "sharp";
import { CATEGORY_MAX_WIDTH, PRODUCT_MAX_WIDTH, WEBP_QUALITY } from "lib/images/constants";

export async function resizeToWebp(input: Buffer, maxWidth: number): Promise<Buffer> {
  return sharp(input)
    .resize(maxWidth, undefined, { withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

export async function resizeProductToWebp(input: Buffer): Promise<Buffer> {
  return resizeToWebp(input, PRODUCT_MAX_WIDTH);
}

export async function resizeCategoryToWebp(input: Buffer): Promise<Buffer> {
  try {
    const trimmed = await sharp(input)
      .trim({ threshold: 18 })
      .resize(CATEGORY_MAX_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    return trimmed;
  } catch {
    return resizeToWebp(input, CATEGORY_MAX_WIDTH);
  }
}
