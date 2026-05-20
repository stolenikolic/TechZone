import { getServerBaseUrl } from "utils/site-url";

/** UI logo (SVG). */
export const SITE_LOGO_PATH = "/assets/images/logo.svg";

/** OG/WhatsApp/Viber — raster PNG iz istog loga (SVG ne radi u previewu). */
export const SITE_LOGO_OG_PATH = "/assets/images/logo-og.png";

export function absoluteOgImageUrl(url: string | null | undefined): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return absoluteOgImageUrl(SITE_LOGO_OG_PATH);
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = getServerBaseUrl().replace(/\/$/, "");
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

/** Default OG slika (logo PNG 1200×630) za sve stranice osim kategorija i proizvoda. */
export function siteLogoOgImage() {
  return {
    url: absoluteOgImageUrl(SITE_LOGO_OG_PATH),
    width: 1200,
    height: 630,
    alt: "Tech Zone",
    type: "image/png" as const
  };
}
