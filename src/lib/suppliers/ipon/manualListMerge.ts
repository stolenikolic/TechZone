/**
 * Pure merge of an iPon list row and an optional tracking row.
 * No HTTP and no database. The manual category import is the only caller.
 */

import type { IponTrackingProduct } from "./trackingApi";
import type { IponProductItem } from "./transformProduct";

const IPON_ORIGIN = "https://iponcomp.com";

export type IponManualListPage = {
  items: Record<string, unknown>[];
  /** Length of the raw `items` array, including non-objects. */
  itemCount: number;
  total: number | null;
  pageSize: number | null;
};

export type ManualListCompleteness = {
  errored: boolean;
  timedOut: boolean;
  total: number | null;
  fetchedCount: number;
  lastPageShort: boolean;
};

export type ManualListMerge =
  | { ok: true; item: IponProductItem; active: boolean }
  | { ok: false };

function positivePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** List `isBuyable: false` is an inactive offer. A missing flag stays active. */
export function manualOfferIsActive(isBuyable: unknown): boolean {
  return isBuyable !== false;
}

export function absoluteIponWebUrl(webUrl: string): string {
  if (webUrl.startsWith("http://") || webUrl.startsWith("https://")) return webUrl;
  if (webUrl.startsWith("/")) return `${IPON_ORIGIN}${webUrl}`;
  return `${IPON_ORIGIN}/${webUrl}`;
}

/**
 * Envelope must be `{ items: [...] }`. A bare array or a missing `items` key
 * is a failed page, not an empty category.
 */
export function parseIponManualListPage(body: unknown): IponManualListPage | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const rec = body as Record<string, unknown>;
  if (!Array.isArray(rec.items)) return null;
  const items = rec.items.filter(
    (row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row)
  );
  const totalRaw = rec.total ?? rec.totalCount;
  const total =
    typeof totalRaw === "number" && Number.isFinite(totalRaw) && totalRaw >= 0 ? Math.trunc(totalRaw) : null;
  const pageSizeRaw = rec.pageSize;
  const pageSize =
    typeof pageSizeRaw === "number" && Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.trunc(pageSizeRaw)
      : null;
  return { items, itemCount: rec.items.length, total, pageSize };
}

export function mergeManualListProduct(
  list: Record<string, unknown>,
  tracking: IponTrackingProduct | null
): ManualListMerge {
  const id = list.id;
  if (typeof id !== "number" && typeof id !== "string") return { ok: false };
  const idText = String(id).trim();
  if (!idText) return { ok: false };

  const displayName = tracking?.displayName.trim() || text(list.name) || "";
  if (!displayName) return { ok: false };

  const grossPrice = positivePrice(list.price) ?? tracking?.grossPrice ?? null;
  if (grossPrice == null) return { ok: false };

  const item: IponProductItem = {
    id: typeof id === "number" && Number.isFinite(id) ? id : idText,
    displayName,
    grossPrice
  };
  const imageUrl = text(list.imageUrl);
  if (imageUrl) item.pictures = [imageUrl];
  const webUrl = text(list.webUrl);
  if (webUrl) item.url = absoluteIponWebUrl(webUrl);
  const description = text(list.description);
  if (description) item.description = description;
  const brand = tracking?.brand?.trim() ? tracking.brand.trim() : "";
  if (brand) item.brand = brand;
  if (tracking?.plusDays != null) item.deliveryDays = tracking.plusDays;
  if (list.isBuyable === false || list.isBuyable === true) item.isBuyable = list.isBuyable;

  return { ok: true, item, active: manualOfferIsActive(list.isBuyable) };
}

/**
 * Overlay list/tracking fields onto the stored payload.
 * Leaves identifiers and the ingested-image marker in place when this run
 * does not have a replacement.
 */
export function mergeManualRawJson(existing: unknown, item: IponProductItem): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const overlay: Record<string, unknown> = {
    id: item.id,
    displayName: item.displayName,
    grossPrice: item.grossPrice
  };
  if (typeof item.url === "string" && item.url) overlay.url = item.url;
  if (Array.isArray(item.pictures) && item.pictures.length > 0) overlay.pictures = item.pictures;
  if (typeof item.description === "string" && item.description.trim()) overlay.description = item.description;
  if (typeof item.brand === "string" && item.brand.trim()) overlay.brand = item.brand.trim();
  if (typeof item.deliveryDays === "number" && Number.isFinite(item.deliveryDays)) {
    overlay.deliveryDays = item.deliveryDays;
  }
  if (item.isBuyable === false || item.isBuyable === true) overlay.isBuyable = item.isBuyable;
  return { ...base, ...overlay };
}

/**
 * A pass may deactivate offers only when the list was read to the end.
 * `total: 0` with an empty page is complete. An empty page without `total`
 * is not, so a bad envelope cannot wipe the category.
 */
export function isManualListImportComplete(state: ManualListCompleteness): boolean {
  if (state.errored || state.timedOut) return false;
  if (state.total != null) return state.fetchedCount === state.total;
  if (state.fetchedCount === 0) return false;
  return state.lastPageShort;
}
