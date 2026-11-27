"use client";

import { useSyncExternalStore } from "react";
import {
  LISTING_SORT_STORAGE_KEY,
  parseListingSort,
  type ListingSort
} from "lib/shop/listing-sort";

function readSavedSort(): ListingSort | null {
  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${LISTING_SORT_STORAGE_KEY}=`));
  const fromCookie = parseListingSort(cookie?.slice(LISTING_SORT_STORAGE_KEY.length + 1));
  if (fromCookie) return fromCookie;

  try {
    return parseListingSort(localStorage.getItem(LISTING_SORT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function getSnapshot(): ListingSort {
  return readSavedSort() ?? "relevance";
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LISTING_SORT_STORAGE_KEY, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LISTING_SORT_STORAGE_KEY, onStoreChange);
  };
}

export function writeListingSort(sort: ListingSort) {
  try {
    localStorage.setItem(LISTING_SORT_STORAGE_KEY, sort);
  } catch {
    // Private mode can reject storage; the cookie still remembers the choice.
  }
  document.cookie = `${LISTING_SORT_STORAGE_KEY}=${sort}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(LISTING_SORT_STORAGE_KEY));
}

export function useListingSort(initialSort: ListingSort) {
  const sort = useSyncExternalStore(subscribe, getSnapshot, () => initialSort);
  return { sort, setSort: writeListingSort };
}
