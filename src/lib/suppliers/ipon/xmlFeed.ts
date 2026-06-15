/**
 * iPon Argep/XML feed parser — stream <termek> blocks, map supplier_product_id → price/delivery.
 */

import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

export type IponXmlFeedEntry = {
  price: number;
  deliveryDays: number | null;
};

const TERMek_OPEN = "<termek";
const TERMek_CLOSE = "</termek>";
const FEED_HEAD_PEEK_BYTES = 2048;

/** Iz zaglavlja feeda: `<!-- CreatedAt: 2026-06-15 11:25:06 -->` */
export function parseIponXmlFeedCreatedAt(xmlHead: string): string | null {
  const m = xmlHead.match(/<!--\s*CreatedAt:\s*(.+?)\s*-->/i);
  return m?.[1]?.trim() ?? null;
}

/** Pročita prvih par KB feeda i vrati CreatedAt iz XML komentara. */
export async function peekIponXmlFeedCreatedAt(options: {
  feedUrl?: string;
  fixturePath?: string;
}): Promise<string | null> {
  const fixture = options.fixturePath?.trim();
  if (fixture) {
    const text = await readFile(fixture, "utf8");
    return parseIponXmlFeedCreatedAt(text.slice(0, FEED_HEAD_PEEK_BYTES));
  }

  const url = options.feedUrl?.trim();
  if (!url) return null;

  const fetchHeaders = {
    Accept: "application/xml, text/xml, */*",
    "User-Agent": "TechZone-iPon-XmlSync/1.0"
  };

  try {
    const rangeRes = await fetch(url, {
      headers: { ...fetchHeaders, Range: `bytes=0-${FEED_HEAD_PEEK_BYTES - 1}` }
    });
    if (rangeRes.ok || rangeRes.status === 206) {
      const createdAt = parseIponXmlFeedCreatedAt(await rangeRes.text());
      if (createdAt) return createdAt;
    }
  } catch {
    /* Range nije podržan — fallback na prvi chunk */
  }

  const res = await fetch(url, { headers: fetchHeaders });
  if (!res.ok || !res.body) return null;

  const reader = res.body.getReader();
  try {
    const { value } = await reader.read();
    if (!value) return null;
    return parseIponXmlFeedCreatedAt(Buffer.from(value).toString("utf8").slice(0, FEED_HEAD_PEEK_BYTES));
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

const miniParser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  parseTagValue: true,
  isArray: () => false
});

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Broj na kraju termeklink putanje, fallback utm_content. */
export function extractIponIdFromTermekLink(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) return null;

  const pathMatch = trimmed.match(/\/(\d+)(?:\?|$)/);
  if (pathMatch?.[1]) return pathMatch[1];

  try {
    const utm = new URL(trimmed).searchParams.get("utm_content");
    if (utm && /^\d+$/.test(utm)) return utm;
  } catch {
    /* invalid URL */
  }

  return null;
}

/** Parsira "9 nap", "0 nap", prazan string → broj dana ili null. */
export function parseIponDeliveryFromIdo(ido: string | null | undefined): number | null {
  if (!ido?.trim()) return null;
  const m = ido.trim().match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

function parsePrice(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  const s = firstString(raw);
  if (!s) return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Parsira jedan <termek>...</termek> blok u entry; null ako nevalidan. */
export function parseTermekBlock(block: string): { id: string; entry: IponXmlFeedEntry } | null {
  const xml = block.trim().startsWith("<termek") ? block.trim() : `<termek>${block}</termek>`;
  let parsed: unknown;
  try {
    parsed = miniParser.parse(xml);
  } catch {
    return null;
  }

  const rec =
    parsed && typeof parsed === "object" && parsed !== null && "termek" in parsed
      ? (parsed as { termek: Record<string, unknown> }).termek
      : null;
  if (!rec || typeof rec !== "object") return null;

  const link = firstString(rec.termeklink);
  if (!link) return null;

  const id = extractIponIdFromTermekLink(link);
  if (!id) return null;

  const price = parsePrice(rec.ar);
  if (price == null) return null;

  return {
    id,
    entry: {
      price,
      deliveryDays: parseIponDeliveryFromIdo(firstString(rec.ido))
    }
  };
}

async function* iterTermekBlocksFromReadable(
  stream: NodeJS.ReadableStream
): AsyncGenerator<string> {
  let buffer = "";
  for await (const chunk of stream) {
    buffer += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");

    for (;;) {
      const start = buffer.indexOf(TERMek_OPEN);
      if (start === -1) {
        if (buffer.length > 64) buffer = buffer.slice(-64);
        break;
      }

      const closeIdx = buffer.indexOf(TERMek_CLOSE, start);
      if (closeIdx === -1) {
        if (start > 0) buffer = buffer.slice(start);
        break;
      }

      const end = closeIdx + TERMek_CLOSE.length;
      yield buffer.slice(start, end);
      buffer = buffer.slice(end);
    }
  }

  if (buffer.includes(TERMek_OPEN)) {
    const start = buffer.indexOf(TERMek_OPEN);
    const closeIdx = buffer.indexOf(TERMek_CLOSE, start);
    if (closeIdx !== -1) {
      yield buffer.slice(start, closeIdx + TERMek_CLOSE.length);
    }
  }
}

async function parseTermekStream(
  stream: NodeJS.ReadableStream,
  onProgress?: (count: number) => void
): Promise<Map<string, IponXmlFeedEntry>> {
  const map = new Map<string, IponXmlFeedEntry>();
  let count = 0;

  for await (const block of iterTermekBlocksFromReadable(stream)) {
    const parsed = parseTermekBlock(block);
    if (!parsed) continue;
    map.set(parsed.id, parsed.entry);
    count += 1;
    if (count % 10_000 === 0) onProgress?.(count);
  }

  onProgress?.(count);
  return map;
}

export type ParseIponXmlFeedOptions = {
  /** Lokalni fixture put (IPON_XML_FIXTURE). */
  fixturePath?: string;
  onProgress?: (parsedCount: number) => void;
};

/**
 * Učitava cijeli XML feed u mapu ID → { price, deliveryDays }.
 * Stream parser — ne drži cijeli XML u DOM-u.
 */
export async function parseIponXmlFeed(
  url: string,
  options?: ParseIponXmlFeedOptions
): Promise<Map<string, IponXmlFeedEntry>> {
  const fixture = options?.fixturePath?.trim();
  if (fixture) {
    const text = await readFile(fixture, "utf8");
    const { Readable } = await import("node:stream");
    return parseTermekStream(Readable.from([text]), options?.onProgress);
  }

  const res = await fetch(url, {
    headers: {
      Accept: "application/xml, text/xml, */*",
      "User-Agent": "TechZone-iPon-XmlSync/1.0"
    }
  });

  if (!res.ok) {
    throw new Error(`iPon XML feed HTTP ${res.status}: ${url}`);
  }

  if (!res.body) {
    throw new Error("iPon XML feed: prazan response body");
  }

  const { Readable } = await import("node:stream");
  const nodeStream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);

  return parseTermekStream(nodeStream, options?.onProgress);
}

/** Za lokalni fixture fajl (sync putanja). */
export async function parseIponXmlFeedFromFile(
  filePath: string,
  onProgress?: (count: number) => void
): Promise<Map<string, IponXmlFeedEntry>> {
  return parseTermekStream(createReadStream(filePath, { encoding: "utf8" }), onProgress);
}
