/**
 * Avtera XML feed parser — stream <izdelek> blocks.
 */

import { readFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";
import { resolveAvteraPrice } from "./parsePrice";
import { deliveryDaysForZaloga, isAvteraActiveFromZaloga, parseAvteraZaloga } from "./parseStock";
import type { AvteraPriceFeedEntry, AvteraProduct } from "./types";

const IZDELEK_OPEN = "<izdelek";
const IZDELEK_CLOSE = "</izdelek>";

const miniParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: true,
  isArray: (tagName) => tagName === "lastnost" || tagName === "slika"
});

function numEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const AVTERA_XML_MIN_ITEMS = numEnv("AVTERA_XML_MIN_ITEMS", 1000);

function firstString(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value === "object" && "#text" in value) {
    return firstString((value as { "#text": unknown })["#text"]);
  }
  return null;
}

function attrId(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  const id = rec["@_id"];
  return typeof id === "string" ? id.trim() || null : null;
}

function labeledNode(obj: unknown): { id: string | null; text: string | null } {
  if (obj == null) return { id: null, text: null };
  if (typeof obj === "string") return { id: null, text: obj.trim() || null };
  if (typeof obj !== "object") return { id: null, text: null };
  const rec = obj as Record<string, unknown>;
  return {
    id: attrId(rec),
    text: firstString(rec["#text"] ?? rec)
  };
}

function parseLastnosti(raw: unknown): AvteraProduct["dodatneLastnosti"] {
  if (!raw || typeof raw !== "object") return [];
  const container = raw as Record<string, unknown>;
  const items = container.lastnost;
  const list = Array.isArray(items) ? items : items != null ? [items] : [];
  const out: AvteraProduct["dodatneLastnosti"] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const naziv = typeof rec["@_naziv"] === "string" ? rec["@_naziv"].trim() : "";
    const value = firstString(rec["#text"] ?? rec) ?? "";
    if (!naziv && !value) continue;
    out.push({ naziv, value: value.trim() });
  }
  return out;
}

function parseDodatneSlike(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const container = raw as Record<string, unknown>;
  const items = container.slika;
  const list = Array.isArray(items) ? items : items != null ? [items] : [];
  const urls: string[] = [];
  for (const item of list) {
    const u = firstString(item);
    if (u) urls.push(u);
  }
  return urls;
}

function vendorItemNoFromRecord(rec: Record<string, unknown>): string | null {
  const keys = Object.keys(rec).filter((k) => k.toLowerCase().startsWith("vendoritemno"));
  for (const k of keys) {
    const v = firstString(rec[k]);
    if (v) return v;
  }
  return null;
}

/** Parsira jedan <izdelek>...</izdelek> blok. */
export function parseIzdelekBlock(block: string): AvteraProduct | null {
  const xml = block.trim().startsWith("<izdelek") ? block.trim() : `<izdelek>${block}</izdelek>`;
  let parsed: unknown;
  try {
    parsed = miniParser.parse(xml);
  } catch {
    return null;
  }

  const root =
    parsed && typeof parsed === "object" && parsed !== null && "izdelek" in parsed
      ? (parsed as { izdelek: Record<string, unknown> }).izdelek
      : null;
  if (!root || typeof root !== "object") return null;

  const izdelekID = firstString(root.izdelekID);
  if (!izdelekID) return null;

  const kat = labeledNode(root.kategorija);
  const brand = labeledNode(root.blagovnaZnamka);
  const skupina = labeledNode(root.skupinaIzdelka);
  const dobava = labeledNode(root.dobava);

  return {
    izdelekID,
    vendorItemNo: vendorItemNoFromRecord(root),
    izdelekIme: firstString(root.izdelekIme),
    opis: firstString(root.opis),
    url: firstString(root.url),
    slikaVelika: firstString(root.slikaVelika),
    dodatneSlike: parseDodatneSlike(root.dodatneSlike),
    ppc: typeof root.PPC === "number" ? root.PPC : firstString(root.PPC) ? Number(firstString(root.PPC)) : null,
    cenaAkcijska: firstString(root.cenaAkcijska),
    nabavnaCena: firstString(root.nabavnaCena),
    dc: firstString(root.DC),
    davcnaStopnja: firstString(root.davcnaStopnja),
    kategorijaId: kat.id,
    kategorijaName: kat.text,
    brandId: brand.id,
    brandName: brand.text,
    skupinaIzdelkaId: skupina.id,
    skupinaIzdelkaName: skupina.text,
    dobavaId: dobava.id,
    dobavaText: dobava.text,
    zaloga: parseAvteraZaloga(root.zaloga),
    ean: firstString(root.EAN),
    brutoTeza: firstString(root.brutoTeza),
    brutoDolzina: firstString(root.brutoDolzina),
    brutoSirina: firstString(root.brutoSirina),
    brutoVisina: firstString(root.brutoVisina),
    dodatneLastnosti: parseLastnosti(root.dodatneLastnosti)
  };
}

export function productToPriceEntry(product: AvteraProduct): AvteraPriceFeedEntry | null {
  const price = resolveAvteraPrice(product);
  if (price == null) return null;
  const zaloga = product.zaloga;
  return {
    price,
    zaloga,
    isActive: isAvteraActiveFromZaloga(zaloga),
    deliveryDays: deliveryDaysForZaloga(zaloga)
  };
}

async function* iterIzdelekBlocksFromReadable(
  stream: NodeJS.ReadableStream
): AsyncGenerator<string> {
  let buffer = "";
  for await (const chunk of stream) {
    buffer += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");

    for (;;) {
      const start = buffer.indexOf(IZDELEK_OPEN);
      if (start === -1) {
        if (buffer.length > 64) buffer = buffer.slice(-64);
        break;
      }

      const closeIdx = buffer.indexOf(IZDELEK_CLOSE, start);
      if (closeIdx === -1) {
        if (start > 0) buffer = buffer.slice(start);
        break;
      }

      const end = closeIdx + IZDELEK_CLOSE.length;
      yield buffer.slice(start, end);
      buffer = buffer.slice(end);
    }
  }

  if (buffer.includes(IZDELEK_OPEN)) {
    const start = buffer.indexOf(IZDELEK_OPEN);
    const closeIdx = buffer.indexOf(IZDELEK_CLOSE, start);
    if (closeIdx !== -1) {
      yield buffer.slice(start, closeIdx + IZDELEK_CLOSE.length);
    }
  }
}

export type ParseAvteraXmlFeedOptions = {
  fixturePath?: string;
  onProgress?: (count: number) => void;
};

async function parseIzdelekStream<T>(
  stream: NodeJS.ReadableStream,
  onProgress: ((count: number) => void) | undefined,
  mapFn: (product: AvteraProduct) => T | null
): Promise<Map<string, T>> {
  const map = new Map<string, T>();
  let count = 0;

  for await (const block of iterIzdelekBlocksFromReadable(stream)) {
    const product = parseIzdelekBlock(block);
    if (!product) continue;
    count += 1;
    onProgress?.(count);
    const mapped = mapFn(product);
    if (mapped != null) {
      map.set(product.izdelekID, mapped);
    }
  }

  return map;
}

export async function loadAvteraXmlStream(options?: {
  feedUrl?: string;
  fixturePath?: string;
}): Promise<NodeJS.ReadableStream> {
  const fixture = options?.fixturePath?.trim();
  if (fixture) {
    const { Readable } = await import("node:stream");
    const text = await readFile(fixture, "utf8");
    return Readable.from([text]);
  }

  const url = options?.feedUrl?.trim();
  if (!url) throw new Error("Postavi AVTERA_XML_FEED_URL ili AVTERA_XML_FIXTURE");

  const res = await fetch(url, {
    headers: {
      Accept: "application/xml, text/xml, */*",
      "User-Agent": "TechZone-Avtera-XmlSync/1.0"
    }
  });

  if (!res.ok) throw new Error(`Avtera XML feed HTTP ${res.status}: ${url}`);
  if (!res.body) throw new Error("Avtera XML feed: prazan response body");

  const { Readable } = await import("node:stream");
  return Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
}

export async function countAvteraIzdelekInFeed(options?: {
  feedUrl?: string;
  fixturePath?: string;
  onProgress?: (count: number) => void;
}): Promise<number> {
  const stream = await loadAvteraXmlStream(options);
  let count = 0;
  for await (const block of iterIzdelekBlocksFromReadable(stream)) {
    if (parseIzdelekBlock(block)) {
      count += 1;
      options?.onProgress?.(count);
    }
  }
  return count;
}

export function assertAvteraFeedGuard(parsedCount: number, minItems = AVTERA_XML_MIN_ITEMS): void {
  if (parsedCount < minItems) {
    throw new Error(
      `[Avtera XML] Guard: feed ima samo ${parsedCount} stavki (min ${minItems}) — abort bez DB izmjena.`
    );
  }
}

/** Cijeli feed → svi validni izdelekID → AvteraProduct. */
export async function parseAvteraXmlFeedFull(
  options?: ParseAvteraXmlFeedOptions & { feedUrl?: string }
): Promise<Map<string, AvteraProduct>> {
  const fixture = options?.fixturePath?.trim();
  const feedUrl = options?.feedUrl?.trim() ?? process.env.AVTERA_XML_FEED_URL?.trim();

  const stream = await loadAvteraXmlStream({
    feedUrl: fixture ? undefined : feedUrl,
    fixturePath: fixture
  });

  return parseIzdelekStream(stream, options?.onProgress, (p) => p);
}

/** Cijeli feed → price sync mapa. */
export async function parseAvteraXmlFeedPriceOnly(
  options?: ParseAvteraXmlFeedOptions & { feedUrl?: string }
): Promise<Map<string, AvteraPriceFeedEntry>> {
  const fixture = options?.fixturePath?.trim();
  const feedUrl = options?.feedUrl?.trim() ?? process.env.AVTERA_XML_FEED_URL?.trim();

  const stream = await loadAvteraXmlStream({
    feedUrl: fixture ? undefined : feedUrl,
    fixturePath: fixture
  });

  return parseIzdelekStream(stream, options?.onProgress, (p) => productToPriceEntry(p));
}

export async function parseAvteraXmlFeedFromFile(
  filePath: string,
  onProgress?: (count: number) => void
): Promise<Map<string, AvteraProduct>> {
  const { Readable } = await import("node:stream");
  const text = await readFile(filePath, "utf8");
  return parseIzdelekStream(Readable.from([text]), onProgress, (p) => p);
}

export function filterProductsByCategory(
  products: Map<string, AvteraProduct>,
  categoryId: string
): AvteraProduct[] {
  const id = categoryId.trim();
  return Array.from(products.values()).filter((p) => p.kategorijaId === id);
}
