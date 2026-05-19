export const SEARCH_COLUMNS = ["name", "brand", "mpn", "ean"] as const;

export function getSearchTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[%,()]/g, "").trim())
    .filter(Boolean);
}

export function buildTokenFilter(token: string): string {
  return SEARCH_COLUMNS.map((column) => `${column}.ilike.%${token}%`).join(",");
}

export function parseCategorySlugsParam(param: string | null | undefined): string[] {
  if (!param?.trim()) return [];
  return param
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
}

export function formatCategorySlugsParam(slugs: string[]): string {
  return slugs.join(",");
}
