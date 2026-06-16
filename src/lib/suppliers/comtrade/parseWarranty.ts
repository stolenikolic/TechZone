import type { SpecRow } from "lib/suppliers/shared/spec-snapshot";
import { extractWarrantyMonthsFromSpecRows } from "lib/suppliers/ipon/warranty-from-specs";

const WARRANTY_NAME_HINTS = ["garanc", "warranty", "jamstvo", "garantee", "garantee"];

/**
 * ComTrade garancija: "60M" = 60 mjeseci, uz fallback na generički spec parser.
 */
export function parseComtradeWarrantyMonths(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  const mSuffix = v.match(/^(\d+)\s*M$/i);
  if (mSuffix) {
    const n = parseInt(mSuffix[1], 10);
    return n > 0 && n <= 240 ? n : null;
  }
  const ySuffix = v.match(/^(\d+)\s*Y$/i);
  if (ySuffix) {
    const n = parseInt(ySuffix[1], 10);
    return n > 0 && n <= 20 ? n * 12 : null;
  }
  return null;
}

export function extractComtradeWarrantyMonths(specRows: SpecRow[]): number | null {
  for (const row of specRows) {
    const name = row.name.toLowerCase();
    if (!WARRANTY_NAME_HINTS.some((h) => name.includes(h))) continue;
    const fromComtrade = parseComtradeWarrantyMonths(row.value);
    if (fromComtrade != null) return fromComtrade;
  }
  return extractWarrantyMonthsFromSpecRows(specRows);
}
