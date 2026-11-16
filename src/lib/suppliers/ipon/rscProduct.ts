/**
 * iPon product page as a Next.js Flight (RSC) payload.
 * One GET of /shop/product/{slug}/{id} with RSC: 1.
 */

import type { SpecRow } from "lib/suppliers/shared/spec-snapshot";

export type IponRscProduct = {
  specs: SpecRow[];
  images: string[];
  manufacturerUrl: string | null;
};

type FlightRows = Map<string, unknown>;

export function isIponEnglishProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "iponcomp.com" && /^\/shop\/product\/[^/]+\/\d+\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function productIdFromIponUrl(url: string): string | null {
  const match = url.match(/\/(\d+)\/?$/);
  return match?.[1] ?? null;
}

/** Flight `T` lengths are UTF-8 bytes, not JavaScript string indexes. */
function advanceUtf8(text: string, start: number, byteLength: number): number {
  let bytes = 0;
  let i = start;
  while (i < text.length && bytes < byteLength) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
    i += 1;
  }
  return i;
}

function parseFlightRows(flight: string): FlightRows {
  const text = flight.charCodeAt(0) === 0xfeff ? flight.slice(1) : flight;
  const rows: FlightRows = new Map();
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === ":") {
      const nl = text.indexOf("\n", i);
      i = nl === -1 ? text.length : nl + 1;
      continue;
    }

    const colon = text.indexOf(":", i);
    if (colon < 0 || colon - i > 12) break;
    const id = text.slice(i, colon);
    if (!/^[0-9a-zA-Z]+$/.test(id)) break;

    const restStart = colon + 1;
    if (text[restStart] === "T") {
      const comma = text.indexOf(",", restStart);
      const token = comma > restStart ? text.slice(restStart + 1, comma) : "";
      const len = /^[0-9a-fA-F]+$/.test(token) ? Number.parseInt(token, 16) : Number.NaN;
      if (!Number.isFinite(len) || len < 0) break;
      i = advanceUtf8(text, comma + 1, len);
      if (text[i] === "\n") i += 1;
      continue;
    }

    const nl = text.indexOf("\n", restStart);
    const lineEnd = nl === -1 ? text.length : nl;
    const payload = text.slice(restStart, lineEnd).replace(/\r$/, "");
    if (payload.startsWith("{") || payload.startsWith("[") || payload.startsWith('"')) {
      try {
        rows.set(id, JSON.parse(payload) as unknown);
      } catch {
        /* module or hint row */
      }
    }
    i = lineEnd + 1;
  }

  return rows;
}

function resolveNode(node: unknown, rows: FlightRows, stack: Set<string>): unknown {
  if (typeof node === "string" && node.startsWith("$L")) {
    const id = node.slice(2);
    if (!rows.has(id) || stack.has(id)) return node;
    stack.add(id);
    const resolved = resolveNode(rows.get(id), rows, stack);
    stack.delete(id);
    return resolved;
  }
  if (Array.isArray(node)) return node.map((item) => resolveNode(item, rows, stack));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = resolveNode(value, rows, stack);
    }
    return out;
  }
  return node;
}

function findSpecNode(node: unknown, rows: FlightRows, seen: Set<string>): unknown | null {
  if (typeof node === "string" && node.startsWith("$L")) {
    const id = node.slice(2);
    if (seen.has(id) || !rows.has(id)) return null;
    seen.add(id);
    return findSpecNode(rows.get(id), rows, seen);
  }
  if (!node || typeof node !== "object") return null;
  if (!Array.isArray(node) && (node as { id?: unknown }).id === "specifikacio") return node;
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const value of values) {
    const hit = findSpecNode(value, rows, seen);
    if (hit) return hit;
  }
  return null;
}

function textOf(node: unknown): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "number") return String(node);
  if (typeof node === "string") return node.startsWith("$") ? "" : node;
  if (Array.isArray(node)) {
    if (node[0] === "$") return textOf(node[3]);
    return node.map((item) => textOf(item)).join("");
  }
  if (typeof node === "object") return textOf((node as { children?: unknown }).children);
  return "";
}

function collectSpecRows(node: unknown, acc: SpecRow[], seen: Set<unknown>): void {
  if (!node || typeof node !== "object") return;
  if (seen.has(node)) return;
  seen.add(node);

  if (!Array.isArray(node)) {
    const record = node as { className?: unknown; children?: unknown };
    const className = typeof record.className === "string" ? record.className : "";
    const children = record.children;
    if (className.includes("grid-cols-") && Array.isArray(children) && children.length >= 2) {
      const name = textOf(children[0]).replace(/\s+/g, " ").trim();
      const value = textOf(children[1]).replace(/\s+/g, " ").trim();
      if (name && value) acc.push({ name, value });
    }
  }

  const values = Array.isArray(node) ? node : Object.values(node);
  for (const value of values) collectSpecRows(value, acc, seen);
}

type ImageCandidate = {
  id: string | null;
  images: string[];
  manufacturerUrl: string | null;
};

function asImageCandidate(node: unknown): ImageCandidate | null {
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  const record = node as { id?: unknown; images?: unknown; manufacturerUrl?: unknown };
  if (!Array.isArray(record.images) || record.images.length === 0) return null;
  const images = record.images.filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url));
  if (images.length === 0) return null;
  const manufacturerUrl =
    typeof record.manufacturerUrl === "string" && record.manufacturerUrl.trim()
      ? record.manufacturerUrl.trim()
      : null;
  const id =
    typeof record.id === "number" && Number.isFinite(record.id)
      ? String(record.id)
      : typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : null;
  return { id, images, manufacturerUrl };
}

function collectImageCandidates(node: unknown, acc: ImageCandidate[], seen: Set<unknown>): void {
  if (!node || typeof node !== "object") return;
  if (seen.has(node)) return;
  seen.add(node);
  const candidate = asImageCandidate(node);
  if (candidate) acc.push(candidate);
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const value of values) collectImageCandidates(value, acc, seen);
}

function pickImages(candidates: ImageCandidate[], productId: string | null): ImageCandidate | null {
  if (candidates.length === 0) return null;
  if (productId) {
    const match = candidates.find((candidate) => candidate.id === productId);
    if (match) return match;
  }
  return candidates.find((candidate) => candidate.manufacturerUrl) ?? candidates[0] ?? null;
}

export function parseIponRscFlight(flight: string, productId?: string | null): IponRscProduct {
  const rows = parseFlightRows(flight);
  const values = Array.from(rows.values());
  const specNode = findSpecNode(values, rows, new Set());
  const specs: SpecRow[] = [];
  if (specNode) {
    collectSpecRows(resolveNode(specNode, rows, new Set()), specs, new Set());
  }

  const candidates: ImageCandidate[] = [];
  for (const value of values) {
    collectImageCandidates(resolveNode(value, rows, new Set()), candidates, new Set());
  }
  const picked = pickImages(candidates, productId ?? null);

  return {
    specs,
    images: picked?.images ?? [],
    manufacturerUrl: picked?.manufacturerUrl ?? null
  };
}
