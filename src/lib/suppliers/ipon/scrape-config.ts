/**
 * iPon detail scrape: ponašanje zahtjeva (delay, referer) i mapa kategorija → obavezni atributi u `products.attributes`.
 * Poslovna logika (red, parsiranje, DB) ostaje u `scrapeDetails.ts`.
 */

/** Slugovi koji se za procesore mapiraju iz JSON-LD / additionalProperty (isti skup za upis i za provjeru reda). */
export const IPON_CPU_CATEGORY_ID = "b7acf048-472c-4d15-af63-a9c78883ba15";

export const IPON_CPU_DETAIL_ATTRIBUTE_SLUGS = [
  "boxed",
  "cpu_family",
  "socket",
  "integrated_vga",
  "integrated_vga_chip",
  "tdp",
  "clock_speed",
  "turbo_frequency"
] as const;

/** Slugovi koji se za matične ploče mapiraju iz JSON-LD / additionalProperty. */
export const IPON_MOTHERBOARD_CATEGORY_ID = "bc6b63f8-ac4e-44cc-82e6-030cebee187d";

export const IPON_MOTHERBOARD_DETAIL_ATTRIBUTE_SLUGS = [
  "socket",
  "chipset",
  "memory_type",
  "memory_sockets",
  "m2_connectors"
] as const;

export type IponCategoryScrapeConfig = {
  /** Koji slugovi moraju biti u `products.attributes` da red (d) ne traži ponovni scrape */
  requiredAttributes: readonly string[];
};

/**
 * `products.category_id` → šta smatramo “kompletnim” detail scrapeom za tu kategoriju.
 * Dodaj novi unos za SSD, RAM, … — bez mijenjanja glavnog toka u `scrapeDetails.ts`.
 */
export const CATEGORY_SCRAPE_CONFIG: Record<string, IponCategoryScrapeConfig> = {
  /** procesori — `categories.ts` internalCategoryId */
  [IPON_CPU_CATEGORY_ID]: {
    requiredAttributes: [...IPON_CPU_DETAIL_ATTRIBUTE_SLUGS]
  },
  /** matične ploče — `categories.ts` internalCategoryId */
  [IPON_MOTHERBOARD_CATEGORY_ID]: {
    requiredAttributes: [...IPON_MOTHERBOARD_DETAIL_ATTRIBUTE_SLUGS]
  }
};

export function getRequiredAttributesForCategory(categoryId: string | undefined): readonly string[] | undefined {
  if (!categoryId) return undefined;
  return CATEGORY_SCRAPE_CONFIG[categoryId]?.requiredAttributes;
}

/** Unija svih slugova iz konfiguracije — za `loadAttributeSlugMap` / `.in("slug", …)` */
export function allConfiguredDetailAttributeSlugs(): string[] {
  const s = new Set<string>();
  for (const c of Object.values(CATEGORY_SCRAPE_CONFIG)) {
    for (const slug of c.requiredAttributes) s.add(slug);
  }
  return Array.from(s);
}

export function randomDelay(minMs: number, jitterMs: number): number {
  return minMs + Math.floor(Math.random() * jitterMs);
}

/** Rotacija Referer-a kao u browseru (listing, origin, /shop/). */
export function getRandomReferer(categoryListingUrl: string): string {
  const base = new URL(categoryListingUrl).origin;
  const referers = [categoryListingUrl, base, `${base}/shop/`];
  return referers[Math.floor(Math.random() * referers.length)];
}
