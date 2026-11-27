export const LISTING_SORT_STORAGE_KEY = "tz-listing-sort";

export const LISTING_SORTS = ["relevance", "date", "asc", "desc"] as const;

export type ListingSort = (typeof LISTING_SORTS)[number];

export function parseListingSort(value: string | null | undefined): ListingSort | null {
  const v = value?.trim().toLowerCase();
  return v === "relevance" || v === "date" || v === "asc" || v === "desc" ? v : null;
}

/** Address wins. A page without `sort` keeps the saved choice. */
export function resolveListingSort(
  urlSort: string | null | undefined,
  saved: string | null | undefined
): ListingSort {
  return parseListingSort(urlSort) ?? parseListingSort(saved) ?? "relevance";
}
