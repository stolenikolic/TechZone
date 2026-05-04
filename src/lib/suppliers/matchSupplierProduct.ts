import { createSupabaseServiceClient } from "utils/supabase";
import { normalizeEan, normalizeMpn } from "./normalizeProductIdentifiers";

type SupabaseClient = ReturnType<typeof createSupabaseServiceClient>;

type ProductIdentifierRow = {
  id: string;
  mpn: string | null;
  ean: string | null;
  created_at?: string | null;
};

export type MatchSkipReason =
  | "missing_identifiers"
  | "ambiguous_ean"
  | "ambiguous_mpn"
  | "no_unique_match";

export type MatchAudit = {
  result: "linked" | "skipped";
  method: "ean" | "mpn" | "none";
  reason?: MatchSkipReason;
  candidateCount: number;
  normalized: {
    ean: string | null;
    mpn: string | null;
  };
  matchedProductId?: string;
};

export type MatchResolution =
  | {
      productId: string;
      method: "ean" | "mpn";
      audit: MatchAudit;
    }
  | {
      productId: null;
      method: "none";
      audit: MatchAudit;
    };

export function mergeMatchAudit(rawJson: unknown, audit: MatchAudit) {
  const base =
    rawJson && typeof rawJson === "object" && !Array.isArray(rawJson)
      ? (rawJson as Record<string, unknown>)
      : {};
  return { ...base, matchAudit: audit };
}

function normalizeMpnForCompare(value: string | null | undefined) {
  const normalized = normalizeMpn(value);
  return normalized ? normalized.toLowerCase() : null;
}

function uniqueMatches(rows: ProductIdentifierRow[], compare: (row: ProductIdentifierRow) => boolean) {
  const unique = new Map<string, ProductIdentifierRow>();
  for (const row of rows) {
    if (!compare(row)) continue;
    if (!unique.has(row.id)) unique.set(row.id, row);
  }
  return Array.from(unique.values());
}

export function decideMatchFromCandidates(
  identifiers: { ean?: string | null; mpn?: string | null },
  candidates: { byEan: ProductIdentifierRow[]; byMpn: ProductIdentifierRow[] }
): MatchResolution {
  const ean = normalizeEan(identifiers.ean);
  const mpn = normalizeMpnForCompare(identifiers.mpn);

  if (ean) {
    const matches = uniqueMatches(candidates.byEan, (row) => normalizeEan(row.ean) === ean);
    if (matches.length === 1) {
      return {
        productId: matches[0].id,
        method: "ean",
        audit: {
          result: "linked",
          method: "ean",
          candidateCount: 1,
          normalized: { ean, mpn: mpn ? normalizeMpn(identifiers.mpn) : null },
          matchedProductId: matches[0].id
        }
      };
    }
    if (matches.length > 1) {
      return {
        productId: null,
        method: "none",
        audit: {
          result: "skipped",
          method: "ean",
          reason: "ambiguous_ean",
          candidateCount: matches.length,
          normalized: { ean, mpn: mpn ? normalizeMpn(identifiers.mpn) : null }
        }
      };
    }
  }

  if (mpn) {
    const matches = uniqueMatches(candidates.byMpn, (row) => normalizeMpnForCompare(row.mpn) === mpn);
    if (matches.length === 1) {
      return {
        productId: matches[0].id,
        method: "mpn",
        audit: {
          result: "linked",
          method: "mpn",
          candidateCount: 1,
          normalized: { ean, mpn: normalizeMpn(identifiers.mpn) },
          matchedProductId: matches[0].id
        }
      };
    }
    if (matches.length > 1) {
      return {
        productId: null,
        method: "none",
        audit: {
          result: "skipped",
          method: "mpn",
          reason: "ambiguous_mpn",
          candidateCount: matches.length,
          normalized: { ean, mpn: normalizeMpn(identifiers.mpn) }
        }
      };
    }
  }

  const reason: MatchSkipReason = ean || mpn ? "no_unique_match" : "missing_identifiers";
  return {
    productId: null,
    method: "none",
    audit: {
      result: "skipped",
      method: "none",
      reason,
      candidateCount: 0,
      normalized: { ean, mpn: mpn ? normalizeMpn(identifiers.mpn) : null }
    }
  };
}

async function loadProductsByEan(supabase: SupabaseClient, normalizedEan: string) {
  const { data, error } = await supabase
    .from("products")
    .select("id, ean, mpn, created_at")
    .eq("ean", normalizedEan)
    .limit(25);

  if (error) throw new Error(`products EAN lookup failed: ${error.message}`);
  return (data ?? []) as ProductIdentifierRow[];
}

async function loadProductsByMpn(supabase: SupabaseClient, normalizedMpn: string) {
  const { data, error } = await supabase
    .from("products")
    .select("id, ean, mpn, created_at")
    .ilike("mpn", normalizedMpn)
    .limit(25);

  if (error) throw new Error(`products MPN lookup failed: ${error.message}`);
  return (data ?? []) as ProductIdentifierRow[];
}

export async function resolveSupplierProductMatch(
  supabase: SupabaseClient,
  identifiers: { ean?: string | null; mpn?: string | null }
): Promise<MatchResolution> {
  const normalizedEan = normalizeEan(identifiers.ean);
  const normalizedMpn = normalizeMpn(identifiers.mpn);

  const [byEan, byMpn] = await Promise.all([
    normalizedEan ? loadProductsByEan(supabase, normalizedEan) : Promise.resolve([]),
    normalizedMpn ? loadProductsByMpn(supabase, normalizedMpn) : Promise.resolve([])
  ]);

  return decideMatchFromCandidates(identifiers, { byEan, byMpn });
}
