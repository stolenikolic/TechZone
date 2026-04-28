import {
  getEnabledCategorySources,
  type SupplierCategorySource
} from "lib/suppliers/supplier-category-source";
import { parseGroupIdFromListingUrl } from "./ipon-fetch";

/** Red u `suppliers` (seed). */
export const IPON_SUPPLIER_ID = "a10f40b1-1c98-462d-81e8-47c1bef989db";

/**
 * Jedan zapis = jedna iPon listing kategorija za sync.
 * Dodaj nove redove u niz — nema posebnih fajlova po kategoriji.
 */
export type IponCategory = {
  name: string;
  /** Puni URL listing stranice (sadrži group id u putanji). */
  url: string;
  /** Naš `categories.id`. */
  internalCategoryId: string;
  /**
   * iPon numerički group id; ako izostane, parsira se iz `url`.
   * Eksplicitno postavi ako URL nema broj na kraju.
   */
  supplierCategoryId?: number;
};

export const IPON_CATEGORIES: IponCategory[] = [
  {
    name: "procesori",
    url: "https://iponcomp.com/shop/group/pc-accessories/cpu/98",
    internalCategoryId: "b7acf048-472c-4d15-af63-a9c78883ba15",
    supplierCategoryId: 98
  },
  {
    name: "maticne-ploce",
    url: "https://iponcomp.com/shop/group/pc-accessories/motherboard/79",
    internalCategoryId: "bc6b63f8-ac4e-44cc-82e6-030cebee187d",
    supplierCategoryId: 79
  }
];

export function getIponSupplierGroupId(cat: IponCategory): number {
  if (cat.supplierCategoryId != null) return cat.supplierCategoryId;
  return parseGroupIdFromListingUrl(cat.url);
}

/** Registry za dokumentaciju / budući UI — generiše se iz `IPON_CATEGORIES`. */
export const IPON_CATEGORY_SOURCES: SupplierCategorySource[] = IPON_CATEGORIES.map((c) => ({
  supplierCategoryId: getIponSupplierGroupId(c),
  internalCategoryId: c.internalCategoryId,
  enabled: true,
  label: c.name,
  listingUrl: c.url
}));

export function getEnabledIponCategorySources(): SupplierCategorySource[] {
  return getEnabledCategorySources(IPON_CATEGORY_SOURCES);
}

/** Podrazumevani listing za referer pri scrape-u (prva uključena kategorija). */
export function getDefaultIponListingUrl(): string {
  const first = IPON_CATEGORIES[0];
  if (!first) throw new Error("IPON_CATEGORIES je prazan — dodaj kategoriju u categories.ts");
  return first.url;
}

export function getIponListingUrlByInternalCategoryId(categoryId: string | undefined): string | null {
  if (!categoryId) return null;
  return IPON_CATEGORIES.find((c) => c.internalCategoryId === categoryId)?.url ?? null;
}

/** `name` kao u nizu (`"procesori"`, …) → `internalCategoryId` za filter u upitima. */
export function getIponCategoryInternalIdByName(name: string): string | null {
  const n = name.trim().toLowerCase();
  const hit = IPON_CATEGORIES.find((c) => c.name.toLowerCase() === n);
  return hit?.internalCategoryId ?? null;
}
