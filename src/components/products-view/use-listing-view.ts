"use client";

import { useSyncExternalStore } from "react";
import {
  LISTING_VIEW_PHONE_QUERY,
  LISTING_VIEW_STORAGE_KEY,
  parseListingView,
  type ListingView
} from "lib/shop/listing-view";

function readSavedView(): ListingView | null {
  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${LISTING_VIEW_STORAGE_KEY}=`));
  const fromCookie = parseListingView(cookie?.slice(LISTING_VIEW_STORAGE_KEY.length + 1));
  if (fromCookie) return fromCookie;

  try {
    return parseListingView(localStorage.getItem(LISTING_VIEW_STORAGE_KEY));
  } catch {
    return null;
  }
}

function getSnapshot(): ListingView {
  const saved = readSavedView();
  if (saved) return saved;
  return window.matchMedia(LISTING_VIEW_PHONE_QUERY).matches ? "list" : "grid";
}

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia(LISTING_VIEW_PHONE_QUERY);
  media.addEventListener("change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LISTING_VIEW_STORAGE_KEY, onStoreChange);
  return () => {
    media.removeEventListener("change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LISTING_VIEW_STORAGE_KEY, onStoreChange);
  };
}

export function writeListingView(view: ListingView) {
  try {
    localStorage.setItem(LISTING_VIEW_STORAGE_KEY, view);
  } catch {
    // Private mode can reject storage; the cookie still remembers the choice.
  }
  document.cookie = `${LISTING_VIEW_STORAGE_KEY}=${view}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(LISTING_VIEW_STORAGE_KEY));
}

export function useListingView(initialView: ListingView) {
  const view = useSyncExternalStore(subscribe, getSnapshot, () => initialView);
  return { view, setView: writeListingView };
}
