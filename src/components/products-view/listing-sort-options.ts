export const LISTING_SORT_OPTIONS = [
  { label: "Preporučeno", value: "relevance" },
  { label: "Najnovije", value: "date" },
  { label: "Najjeftinije", value: "asc" },
  { label: "Najskuplje", value: "desc" }
] as const;

export type ListingSortValue = (typeof LISTING_SORT_OPTIONS)[number]["value"];
