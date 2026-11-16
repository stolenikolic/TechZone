/**
 * iPon Hungarian <product> feed — identifiers, EAN/MPN, main image, category path.
 * The first price of a new article can come from gross_price. Later price changes stay on XML sync.
 */

import { Readable } from "node:stream";
import { XMLParser } from "fast-xml-parser";

export const DEFAULT_IPON_PRODUCT_FEED_URL = "https://media.icdn.hu/feeds/ipon-feed-hu-hu.xml";
export const DEFAULT_IPON_PRODUCT_FEED_MIN_ITEMS = 50_000;

export type IponFeedProduct = {
  identifier: string;
  name: string | null;
  imageUrl: string | null;
  ean: string | null;
  productNumber: string | null;
  manufacturer: string | null;
  productUrl: string | null;
  categoryPath: string | null;
  price: number | null;
};

export class IponProductFeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IponProductFeedError";
  }
}

const PRODUCT_CLOSE = "</product>";

const miniParser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  parseTagValue: true,
  isArray: (name) => name === "beed_feed_tag"
});

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function parsePrice(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  const s = firstString(raw);
  if (!s) return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function firstField(rec: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = firstString(rec[key]);
    if (value) return value;
  }
  return null;
}

/** Split a feed `<category>` path on ` > ` and drop empty pieces. */
export function splitFeedPath(path: string | null | undefined): string[] {
  if (!path) return [];
  return path
    .split(">")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** First two levels. Deeper pieces are breadcrumbs. Fewer than two levels has no key. */
export function twoLevelFeedKey(path: string | null | undefined): string | null {
  const parts = splitFeedPath(path);
  if (parts.length < 2) return null;
  return `${parts[0]} > ${parts[1]}`;
}

/** Empty clears the path. One level is rejected. Two or more levels are kept whole. */
export function manualFeedPathFromInput(raw: unknown): { path: string | null } | { error: string } {
  if (raw == null) return { path: null };
  if (typeof raw !== "string") return { error: "Feed putanja nije tekst." };
  const trimmed = raw.trim();
  if (!trimmed) return { path: null };
  const parts = splitFeedPath(trimmed);
  if (parts.length < 2) return { error: "Feed putanja treba bar dva nivoa, odvojena sa >." };
  return { path: parts.join(" > ") };
}

/** `<product` but not `<products`. */
export function findProductOpen(buffer: string, from = 0): number {
  let idx = from;
  while (idx < buffer.length) {
    const i = buffer.indexOf("<product", idx);
    if (i === -1) return -1;
    const next = buffer[i + "<product".length];
    if (next === ">" || next === " " || next === "\n" || next === "\r" || next === "\t" || next === "/") {
      return i;
    }
    idx = i + "<product".length;
  }
  return -1;
}

/** ipon.hu + /termek/ → iponcomp.com + /product/, utm_* stripped. */
export function toIponEnglishProductUrl(productUrl: string | null | undefined): string | null {
  if (!productUrl?.trim()) return null;
  let url: URL;
  try {
    url = new URL(productUrl.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host === "ipon.hu" || host === "www.ipon.hu") {
    url.hostname = "iponcomp.com";
  }
  url.pathname = url.pathname.replace(/\/termek\//g, "/product/");
  for (const key of Array.from(url.searchParams.keys())) {
    if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
  }
  url.hash = "";
  const search = url.searchParams.toString();
  return `${url.origin}${url.pathname}${search ? `?${search}` : ""}`;
}

export function parseProductBlock(block: string): IponFeedProduct | null {
  const xml = block.trim().startsWith("<product") ? block.trim() : `<product>${block}</product>`;
  let parsed: unknown;
  try {
    parsed = miniParser.parse(xml);
  } catch {
    return null;
  }
  const rec =
    parsed && typeof parsed === "object" && parsed !== null && "product" in parsed
      ? (parsed as { product: Record<string, unknown> }).product
      : null;
  if (!rec || typeof rec !== "object") return null;

  const identifier = firstField(rec, "identifier", "id");
  if (!identifier) return null;

  return {
    identifier,
    name: firstString(rec.name),
    imageUrl: firstField(rec, "image_url", "picture_url"),
    ean: firstString(rec.ean),
    productNumber: firstString(rec.product_number),
    manufacturer: firstField(rec, "manufacturer", "brand"),
    productUrl: firstField(rec, "product_url", "url"),
    categoryPath: firstString(rec.category),
    price: parsePrice(rec.gross_price) ?? parsePrice(rec.price)
  };
}

export async function* iterProductBlocks(stream: AsyncIterable<string | Buffer>): AsyncGenerator<string> {
  let buffer = "";
  for await (const chunk of stream) {
    buffer += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    for (;;) {
      const start = findProductOpen(buffer);
      if (start === -1) {
        if (buffer.length > 64) buffer = buffer.slice(-64);
        break;
      }
      const closeIdx = buffer.indexOf(PRODUCT_CLOSE, start);
      if (closeIdx === -1) {
        if (start > 0) buffer = buffer.slice(start);
        break;
      }
      const end = closeIdx + PRODUCT_CLOSE.length;
      yield buffer.slice(start, end);
      buffer = buffer.slice(end);
    }
  }

  const start = findProductOpen(buffer);
  if (start !== -1) {
    const closeIdx = buffer.indexOf(PRODUCT_CLOSE, start);
    if (closeIdx !== -1) yield buffer.slice(start, closeIdx + PRODUCT_CLOSE.length);
  }
}

export async function parseIponProductFeedFromString(xml: string): Promise<IponFeedProduct[]> {
  const products: IponFeedProduct[] = [];
  for await (const block of iterProductBlocks(Readable.from([xml]))) {
    const parsed = parseProductBlock(block);
    if (parsed) products.push(parsed);
  }
  return products;
}

export type StreamIponProductFeedOptions = {
  minItems?: number;
  onProgress?: (count: number) => void;
  onProduct?: (product: IponFeedProduct) => void;
};

/**
 * Streams the live feed. Throws IponProductFeedError on HTTP failure or a short feed.
 */
export async function streamIponProductFeed(
  url: string,
  options?: StreamIponProductFeedOptions
): Promise<{ count: number }> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/xml, text/xml, */*",
      "User-Agent": "TechZone-iPon-ProductFeed/1.0"
    }
  });
  if (!res.ok) {
    throw new IponProductFeedError(`iPon product feed HTTP ${res.status}: ${url}`);
  }
  if (!res.body) {
    throw new IponProductFeedError("iPon product feed: prazan response body");
  }

  const nodeStream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  let count = 0;
  for await (const block of iterProductBlocks(nodeStream)) {
    const parsed = parseProductBlock(block);
    if (!parsed) continue;
    count += 1;
    options?.onProduct?.(parsed);
    if (count % 10_000 === 0) options?.onProgress?.(count);
  }
  options?.onProgress?.(count);

  const minItems = options?.minItems ?? DEFAULT_IPON_PRODUCT_FEED_MIN_ITEMS;
  if (count < minItems) {
    throw new IponProductFeedError(
      `iPon product feed: samo ${count} stavki (min ${minItems}) — abort bez upisa.`
    );
  }
  return { count };
}
