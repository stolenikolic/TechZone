import { createSupabaseServiceClient } from "utils/supabase";
import { isTransientNetworkError } from "./ipon/transient-retry";
import {
  eanFromMpnField,
  normalizeEan,
  normalizeMpn,
  normalizeMpnForMatchCompare
} from "./normalizeProductIdentifiers";

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
  | "no_unique_match"
  | "lookup_error";

export type MatchMethod =
  | "ean"
  | "mpn"
  | "ean_via_offer"
  | "mpn_via_offer"
  | "none";

export type MatchAudit = {
  result: "linked" | "skipped";
  method: MatchMethod;
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
      method: "ean" | "mpn" | "ean_via_offer" | "mpn_via_offer";
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

function uniqueMatches(rows: ProductIdentifierRow[], compare: (row: ProductIdentifierRow) => boolean) {
  const unique = new Map<string, ProductIdentifierRow>();
  for (const row of rows) {
    if (!compare(row)) continue;
    if (!unique.has(row.id)) unique.set(row.id, row);
  }
  return Array.from(unique.values());
}

/** MPN step: MPN↔MPN plus EAN-in-MPN field ↔ row EAN (parallel, same candidate pool). */
function rowMatchesMpnStep(
  row: ProductIdentifierRow,
  mpnCompare: string,
  eanCross: string | null
): boolean {
  if (normalizeMpnForMatchCompare(row.mpn) === mpnCompare) return true;
  if (eanCross && normalizeEan(row.ean) === eanCross) return true;
  return false;
}

function mergeCandidateRows(rows: ProductIdentifierRow[]): ProductIdentifierRow[] {
  const unique = new Map<string, ProductIdentifierRow>();
  for (const row of rows) {
    if (!unique.has(row.id)) unique.set(row.id, row);
  }
  return Array.from(unique.values());
}

export function decideMatchFromCandidates(
  identifiers: { ean?: string | null; mpn?: string | null },
  candidates: { byEan: ProductIdentifierRow[]; byMpn: ProductIdentifierRow[] }
): MatchResolution {
  const ean = normalizeEan(identifiers.ean);
  const mpn = normalizeMpnForMatchCompare(identifiers.mpn);

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
    const eanCross = eanFromMpnField(identifiers.mpn);
    const matches = uniqueMatches(candidates.byMpn, (row) => rowMatchesMpnStep(row, mpn, eanCross));
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

/** Factor 2: match via linked supplier_products (product_id set). Factor 1 body unchanged above. */
export function decideMatchFromLinkedOffers(
  identifiers: { ean?: string | null; mpn?: string | null },
  candidates: { byEan: ProductIdentifierRow[]; byMpn: ProductIdentifierRow[] }
): MatchResolution {
  const ean = normalizeEan(identifiers.ean);
  const mpn = normalizeMpnForMatchCompare(identifiers.mpn);

  if (ean) {
    const matches = uniqueMatches(candidates.byEan, (row) => normalizeEan(row.ean) === ean);
    if (matches.length === 1) {
      return {
        productId: matches[0].id,
        method: "ean_via_offer",
        audit: {
          result: "linked",
          method: "ean_via_offer",
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
          method: "ean_via_offer",
          reason: "ambiguous_ean",
          candidateCount: matches.length,
          normalized: { ean, mpn: mpn ? normalizeMpn(identifiers.mpn) : null }
        }
      };
    }
  }

  if (mpn) {
    const eanCross = eanFromMpnField(identifiers.mpn);
    const matches = uniqueMatches(candidates.byMpn, (row) => rowMatchesMpnStep(row, mpn, eanCross));
    if (matches.length === 1) {
      return {
        productId: matches[0].id,
        method: "mpn_via_offer",
        audit: {
          result: "linked",
          method: "mpn_via_offer",
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
          method: "mpn_via_offer",
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

function shouldRunLinkedOfferMatch(tier1: MatchResolution): boolean {
  if (tier1.productId) return false;
  const reason = tier1.audit.reason;
  return reason !== "ambiguous_ean" && reason !== "ambiguous_mpn";
}

type LinkedOfferRow = {
  product_id: string;
  mpn: string | null;
  ean: string | null;
};

function mapLinkedOffersToCandidates(rows: LinkedOfferRow[]): ProductIdentifierRow[] {
  return rows.map((row) => ({
    id: row.product_id,
    mpn: row.mpn,
    ean: row.ean,
    created_at: null
  }));
}

async function loadLinkedOffersByEan(supabase: SupabaseClient, normalizedEan: string) {
  const { data, error } = await supabase
    .from("supplier_products")
    .select("product_id, mpn, ean")
    .eq("ean", normalizedEan)
    .not("product_id", "is", null)
    .limit(25);

  if (error) throw new Error(`supplier_products EAN lookup failed: ${error.message}`);
  return mapLinkedOffersToCandidates((data ?? []) as LinkedOfferRow[]);
}

async function loadLinkedOffersByMpn(supabase: SupabaseClient, mpn: string) {
  const compareKey = normalizeMpnForMatchCompare(mpn);
  const eanCross = eanFromMpnField(mpn);
  if (!compareKey && !eanCross) return [];

  const rows: LinkedOfferRow[] = [];

  if (compareKey) {
    const { data, error } = await supabase
      .from("supplier_products")
      .select("product_id, mpn, ean")
      .eq("mpn_match_key", compareKey)
      .not("product_id", "is", null)
      .limit(25);

    if (error) throw new Error(`supplier_products MPN lookup failed: ${error.message}`);
    rows.push(...((data ?? []) as LinkedOfferRow[]));
  }

  if (eanCross) {
    const byEan = await loadLinkedOffersByEan(supabase, eanCross);
    for (const row of byEan) {
      rows.push({ product_id: row.id, mpn: row.mpn, ean: row.ean });
    }
  }

  const filtered = rows.filter((row) =>
    rowMatchesMpnStep(
      { id: row.product_id, mpn: row.mpn, ean: row.ean },
      compareKey ?? "",
      eanCross
    )
  );
  return mapLinkedOffersToCandidates(filtered);
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

async function loadProductsByMpn(supabase: SupabaseClient, mpn: string) {
  const compareKey = normalizeMpnForMatchCompare(mpn);
  const eanCross = eanFromMpnField(mpn);
  if (!compareKey && !eanCross) return [];

  const rows: ProductIdentifierRow[] = [];

  if (compareKey) {
    const { data, error } = await supabase
      .from("products")
      .select("id, ean, mpn, created_at")
      .eq("mpn_match_key", compareKey)
      .limit(25);

    if (error) throw new Error(`products MPN lookup failed: ${error.message}`);
    rows.push(...((data ?? []) as ProductIdentifierRow[]));
  }

  if (eanCross) {
    const byEan = await loadProductsByEan(supabase, eanCross);
    rows.push(...byEan);
  }

  return mergeCandidateRows(rows).filter((row) =>
    rowMatchesMpnStep(row, compareKey ?? "", eanCross)
  );
}

export async function resolveSupplierProductMatch(
  supabase: SupabaseClient,
  identifiers: { ean?: string | null; mpn?: string | null }
): Promise<MatchResolution> {
  const normalizedEan = normalizeEan(identifiers.ean);
  const normalizedMpn = normalizeMpn(identifiers.mpn);

  const mpnForLookup = identifiers.mpn ?? normalizedMpn;
  const [byEan, byMpn] = await Promise.all([
    normalizedEan ? loadProductsByEan(supabase, normalizedEan) : Promise.resolve([]),
    normalizedMpn && mpnForLookup ? loadProductsByMpn(supabase, mpnForLookup) : Promise.resolve([])
  ]);

  const tier1 = decideMatchFromCandidates(identifiers, { byEan, byMpn });
  if (tier1.productId) return tier1;
  if (!shouldRunLinkedOfferMatch(tier1)) return tier1;

  const [byEanOffers, byMpnOffers] = await Promise.all([
    normalizedEan ? loadLinkedOffersByEan(supabase, normalizedEan) : Promise.resolve([]),
    normalizedMpn && mpnForLookup
      ? loadLinkedOffersByMpn(supabase, mpnForLookup)
      : Promise.resolve([])
  ]);

  const tier2 = decideMatchFromLinkedOffers(identifiers, {
    byEan: byEanOffers,
    byMpn: byMpnOffers
  });
  if (tier2.productId) return tier2;
  return tier1;
}

const RESOLVE_MATCH_RETRY_ATTEMPTS = 3;
const RESOLVE_MATCH_RETRY_BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unmatchedFallback(identifiers: { ean?: string | null; mpn?: string | null }): MatchResolution {
  const ean = normalizeEan(identifiers.ean);
  const mpn = normalizeMpn(identifiers.mpn);
  return {
    productId: null,
    method: "none",
    audit: {
      result: "skipped",
      method: "none",
      reason: "lookup_error",
      candidateCount: 0,
      normalized: { ean, mpn }
    }
  };
}

/**
 * Wraps `resolveSupplierProductMatch`: retries transient DB/network errors
 * (e.g. `canceling statement due to statement timeout` under load) with
 * backoff, then degrades to an unmatched ("lookup_error") result instead of
 * throwing. Import/cron jobs call this per-article in a loop — without this,
 * a single transient failure kills the entire run. Prefer this over the raw
 * function in any import/auto-match pipeline.
 */
export async function resolveSupplierProductMatchSafe(
  supabase: SupabaseClient,
  identifiers: { ean?: string | null; mpn?: string | null }
): Promise<MatchResolution> {
  let lastError: unknown;

  for (let attempt = 0; attempt < RESOLVE_MATCH_RETRY_ATTEMPTS; attempt++) {
    try {
      return await resolveSupplierProductMatch(supabase, identifiers);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (attempt < RESOLVE_MATCH_RETRY_ATTEMPTS - 1 && isTransientNetworkError(err)) {
        const delay = RESOLVE_MATCH_RETRY_BASE_DELAY_MS * (attempt + 1);
        console.warn(
          `[matchSupplierProduct] resolveSupplierProductMatch transient error — retry ${attempt + 2}/${RESOLVE_MATCH_RETRY_ATTEMPTS} in ${delay}ms: ${message}`
        );
        await sleep(delay);
        continue;
      }
      break;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  console.error(`[matchSupplierProduct] resolveSupplierProductMatch failed — skipping match: ${message}`);
  return unmatchedFallback(identifiers);
}
