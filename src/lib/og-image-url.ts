import { getServerBaseUrl } from "utils/site-url";

export const SITE_LOGO_PATH = "/assets/images/logo.svg";

export function absoluteOgImageUrl(url: string | null | undefined): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return absoluteOgImageUrl(SITE_LOGO_PATH);
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = getServerBaseUrl().replace(/\/$/, "");
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

/** Default OG slika (logo) za sve stranice osim kategorija i proizvoda. */
export function siteLogoOgImage() {
  return {
    url: absoluteOgImageUrl(SITE_LOGO_PATH),
    width: 353,
    height: 122,
    alt: "Tech Zone",
    type: "image/svg+xml" as const
  };
}
