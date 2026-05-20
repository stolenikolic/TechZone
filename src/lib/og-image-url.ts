import { getServerBaseUrl } from "utils/site-url";

const DEFAULT_OG_IMAGE_PATH = "/assets/images/categories/default-category.jpg";

/**
 * Open Graph crawlers (WhatsApp, Facebook, Viber) require absolute http(s) URLs
 * and raster images (JPEG/PNG/WebP). SVG is not supported.
 */
export function absoluteOgImageUrl(url: string | null | undefined): string {
  const trimmed = url?.trim() ?? "";
  const path = trimmed || DEFAULT_OG_IMAGE_PATH;

  if (/^https?:\/\//i.test(path)) return path;

  const base = getServerBaseUrl().replace(/\/$/, "");
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

export function defaultOgImageMetadata(alt: string) {
  const url = absoluteOgImageUrl(DEFAULT_OG_IMAGE_PATH);
  return {
    url,
    width: 1200,
    height: 630,
    alt,
    type: "image/jpeg" as const
  };
}
