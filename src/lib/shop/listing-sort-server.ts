import { cookies } from "next/headers";
import { LISTING_SORT_STORAGE_KEY, parseListingSort, type ListingSort } from "./listing-sort";

export async function getSavedListingSort(): Promise<ListingSort | null> {
  return parseListingSort((await cookies()).get(LISTING_SORT_STORAGE_KEY)?.value);
}
