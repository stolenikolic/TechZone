import type { Metadata } from "next";
import { getServerBaseUrl } from "utils/site-url";

export const SITE_NAME = "Tech Zone";

/** Glavni SEO opis za javne stranice (bosanski). */
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

export function pageTitle(page: string, scope: "shop" | "admin" = "shop"): string {
  const suffix = scope === "admin" ? `${SITE_NAME} Admin` : SITE_NAME;
  return `${page}${SEP}${suffix}`;
}

export function shopPageMetadata(pageTitleBs: string, description?: string): Metadata {
  return {
    title: pageTitle(pageTitleBs, "shop"),
    description: description ?? SITE_DESCRIPTION,
    keywords: SITE_KEYWORDS
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
  return {
    title: pageTitle(name, "shop"),
    description: description ?? SITE_DESCRIPTION,
    keywords: SITE_KEYWORDS
  };
}

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
    description: SITE_DESCRIPTION
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION
  }
};

export const adminRootMetadata: Metadata = {
  title: `${SITE_NAME} Admin`,
  description: `Administracija ${SITE_NAME} prodavnice.`,
  keywords: SITE_KEYWORDS
};
