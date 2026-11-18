/**
 * Crawl list for Alza.hu. The importer reads this list, not `supplier_categories`,
 * so a partial name-match seed does not drop the broad categories.
 */
export type AlzaCategory = {
  categoryId: number;
  name: string;
};

export const ALZA_CATEGORIES: AlzaCategory[] = [
  { categoryId: 18852654, name: "PC alkatrészek" },
  { categoryId: 18913923, name: "Okos eszközök" },
  { categoryId: 18842920, name: "Laptopok" },
  { categoryId: 18842948, name: "Monitorok" },
  { categoryId: 18842916, name: "Hálózati eszközök" },
  { categoryId: 18861668, name: "Kiegészítők" },
  { categoryId: 18849604, name: "Televíziók" },
  { categoryId: 18843602, name: "Fej- és fülhallgatók" },
  { categoryId: 18843496, name: "Hangfalak" },
  { categoryId: 18843129, name: "Digitális fényképezők" },
  { categoryId: 18843241, name: "Digitális kamerák" },
  { categoryId: 18859887, name: "Lejátszók" }
];
