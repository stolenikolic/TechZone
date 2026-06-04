import type { SpecRow } from "lib/suppliers/shared/spec-snapshot";

const WARRANTY_NAME_HINTS = [
  "garanc",
  "warranty",
  "jamstvo",
  "garancia",
  "szavatoss"
];

function parseMonthsFromValue(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const yearMatch = v.match(/(\d+)\s*(?:god|year|év|godina)/i);
  if (yearMatch) return Math.max(1, parseInt(yearMatch[1], 10) * 12);
  const monthMatch = v.match(/(\d+)\s*(?:mjesec|month|honap|m\b|mj\.)/i) ?? v.match(/^(\d+)$/);
  if (monthMatch) return Math.max(1, parseInt(monthMatch[1], 10));
  return null;
}

/** Extract warranty length in months from scraped spec rows (iPon JSON-LD). */
export function extractWarrantyMonthsFromSpecRows(specRows: SpecRow[]): number | null {
  for (const row of specRows) {
    const name = row.name.toLowerCase();
    if (!WARRANTY_NAME_HINTS.some((h) => name.includes(h))) continue;
    const months = parseMonthsFromValue(row.value);
    if (months != null) return months;
  }
  return null;
}

/** Fallback: scan raw HTML for common Hungarian warranty phrases. */
export function extractWarrantyMonthsFromHtml(html: string): number | null {
  const patterns = [
    /(\d+)\s*(?:év|god|year)/gi,
    /(\d+)\s*(?:hónap|honap|month|mjesec)/gi,
    /garancia[^0-9]{0,40}(\d+)/gi
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n <= 10 && re.source.includes("év")) return n * 12;
      if (n > 0 && n <= 120) return n;
    }
  }
  return null;
}
