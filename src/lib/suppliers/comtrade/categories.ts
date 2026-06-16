import { COMTRADE_SUPPLIER_ID } from "./constants";

/** Pilot + hardcoded fallback — mapira productGroupID na internu kategoriju. */
export type ComtradeCategory = {
  /** ComTrade `productGroupID` (case-sensitive). */
  productGroupId: string;
  /** Naš `categories.id`. */
  internalCategoryId: string;
  label: string;
};

export const PROCESORI_INTERNAL_CATEGORY_ID = "b7acf048-472c-4d15-af63-a9c78883ba15";

export const COMTRADE_CATEGORIES: ComtradeCategory[] = [
  {
    productGroupId: "CPU",
    internalCategoryId: PROCESORI_INTERNAL_CATEGORY_ID,
    label: "procesori"
  }
];

export { COMTRADE_SUPPLIER_ID };
