import { AVTERA_SUPPLIER_ID } from "./constants";

/** Pilot + hardcoded fallback — mapira kategorija/@id na internu kategoriju. */
export type AvteraCategory = {
  /** Avtera `kategorija/@id` (case-sensitive). */
  categoryId: string;
  /** Naš `categories.id` — iz DB supplier_categories ako prazan. */
  internalCategoryId: string;
  label: string;
};

export const AVTERA_CATEGORIES: AvteraCategory[] = [
  {
    categoryId: "MS",
    internalCategoryId: "",
    label: "misevi"
  }
];

export { AVTERA_SUPPLIER_ID };
