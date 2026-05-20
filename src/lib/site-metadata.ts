import type { Metadata } from "next";
import { siteLogoOgImage } from "lib/og-image-url";
import { getServerBaseUrl } from "utils/site-url";

export const SITE_NAME = "Tech Zone";

export const SITE_DESCRIPTION =
  "Tech Zone — online prodavnica računarske opreme, komponenti i gaming opreme u Bosni i Hercegovini. Pregledaj širok asortiman, uporedi specifikacije i naruči uz brzu dostavu.";

export const SITE_KEYWORDS = [
  "tech zone",
  "računari",
  "komponente",
  "gaming oprema",
  "hardware",
  "online prodavnica",
  "BiH",
  "Bosna i Hercegovina"
];

const SEP = " | ";

/** `<title>` — ključne riječi prvo (SEO). */
export function pageTitle(page: string, scope: "shop" | "admin" = "shop"): string {
  const suffix = scope === "admin" ? `${SITE_NAME} Admin` : SITE_NAME;
  return `${page}${SEP}${suffix}`;
}

/** `og:title` / WhatsApp — brend prvo (ne utiče na Google rang). */
export function ogPageTitle(page: string): string {
  const trimmed = page.trim();
  if (!trimmed || trimmed === SITE_NAME) return SITE_NAME;
  return `${SITE_NAME}${SEP}${trimmed}`;
}

function withSiteLogoOg(title: string, description: string): Pick<Metadata, "openGraph" | "twitter"> {
  const logo = siteLogoOgImage();
  return {
    openGraph: {
      title,
      description,
      images: [logo]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [logo.url]
    }
  };
}

export function shopPageMetadata(pageTitleBs: string, description?: string): Metadata {
  const title = pageTitle(pageTitleBs, "shop");
  const ogTitle = ogPageTitle(pageTitleBs);
  const desc = description ?? SITE_DESCRIPTION;
  return {
    title,
    description: desc,
    keywords: SITE_KEYWORDS,
    ...withSiteLogoOg(ogTitle, desc)
  };
}

export function adminPageMetadata(pageTitleBs: string, description?: string): Metadata {
  return {
    title: pageTitle(pageTitleBs, "admin"),
    description:
      description ??
      `Upravljanje sadržajem i postavkama prodavnice u ${SITE_NAME} admin panelu.`,
    keywords: SITE_KEYWORDS
  };
}

export function dynamicShopMetadata(name: string, description?: string): Metadata {
  const title = pageTitle(name, "shop");
  const ogTitle = ogPageTitle(name);
  const desc = description ?? SITE_DESCRIPTION;
  return {
    title,
    description: desc,
    keywords: SITE_KEYWORDS,
    ...withSiteLogoOg(ogTitle, desc)
  };
}

const logo = siteLogoOgImage();

export const rootMetadata: Metadata = {
  metadataBase: new URL(getServerBaseUrl()),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  openGraph: {
    title: SITE_NAME,
    siteName: SITE_NAME,
    locale: "bs_BA",
    type: "website",
    description: SITE_DESCRIPTION,
    images: [logo]
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [logo.url]
  }
};

export const adminRootMetadata: Metadata = {
  title: `${SITE_NAME} Admin`,
  description: `Administracija ${SITE_NAME} prodavnice.`,
  keywords: SITE_KEYWORDS
};
