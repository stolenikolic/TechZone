import { fetchWithSession } from "lib/suppliers/shared/http-session";
import {
  createIponCookieJar,
  getIponOrigin,
  IPON_ACCEPT_LANGUAGE,
  IPON_IMPORT_USER_AGENT
} from "./ipon-fetch";

type IponKeywordItem = {
  id: string;
  slug: string;
  displayName: string;
};

export type IponKeywordLookupResult =
  | { status: "single"; item: IponKeywordItem; total: number }
  | { status: "empty"; total: number }
  | { status: "ambiguous"; total: number; items: IponKeywordItem[] }
  | { status: "error"; message: string };

type IponKeywordApiResponse = {
  items?: unknown;
  total?: unknown;
  count?: unknown;
};

function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function mapKeywordItems(input: unknown): IponKeywordItem[] {
  if (!Array.isArray(input)) return [];
  const rows: IponKeywordItem[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (!slug) continue;

    const idValue = row.id;
    const id = idValue == null ? "" : String(idValue).trim();
    const displayName =
      (typeof row.displayName === "string" && row.displayName.trim()) ||
      (typeof row.productName === "string" && row.productName.trim()) ||
      (typeof row.fullName === "string" && row.fullName.trim()) ||
      slug;

    rows.push({ id, slug, displayName });
  }

  return rows;
}

export async function lookupIponByKeyword(keywordRaw: string): Promise<IponKeywordLookupResult> {
  const keyword = keywordRaw.trim();
  if (!keyword) return { status: "empty", total: 0 };

  const origin = "https://iponcomp.com";
  const endpoint = `${origin}/search/shop/data`;
  const url = new URL(endpoint);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("isInInactive", "1");
  url.searchParams.set("sortOrder", "olcso");
  url.searchParams.set("page", "1");

  const jar = createIponCookieJar();
  const warmupReferer = `${getIponOrigin(endpoint)}/`;

  try {
    const response = await fetchWithSession(
      url.toString(),
      {
        jar,
        userAgent: IPON_IMPORT_USER_AGENT,
        referer: warmupReferer,
        acceptJson: true,
        acceptLanguage: IPON_ACCEPT_LANGUAGE,
        origin
      },
      { method: "GET" }
    );

    if (!response.ok) {
      return { status: "error", message: `iPon keyword API HTTP ${response.status}` };
    }

    const body = (await response.json()) as IponKeywordApiResponse;
    const items = mapKeywordItems(body.items);
    const total = toPositiveNumber(body.total) ?? toPositiveNumber(body.count) ?? items.length;

    if (items.length === 0) return { status: "empty", total };
    if (items.length === 1) return { status: "single", item: items[0], total };

    return { status: "ambiguous", total, items: items.slice(0, 5) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", message };
  }
}
