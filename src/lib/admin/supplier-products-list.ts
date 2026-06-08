import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeFinalSellingKm,
  computeAcquisitionKm,
  resolvePricingSettingsRow,
  resolveSellingMultiplier,
  type PricingMarginTierRow,
  type PricingSettingsRow
} from "lib/pricing";
import {
  buildPaginatedResult,
  type PaginatedResult,
  type PaginationParams
} from "lib/admin/pagination";

type DbSupplier = { name: string | null; code: string | null } | { name: string | null; code: string | null }[] | null;
type DbMasterProductValue = {
  id: string;
  name: string;
  slug: string;
  main_image: string | null;
  selling_margin_override: number | null;
  categories:
    | { selling_margin_default: number | null }
    | { selling_margin_default: number | null }[]
    | null;
};
type DbMasterProduct = DbMasterProductValue | DbMasterProductValue[] | null;

type DbSupplierProduct = {
  id: string;
  supplier_product_id: string;
  product_id: string | null;
  master_match_status: string | null;
  enrichment_status: string | null;
  price_amount: number | null;
  currency: string | null;
  mpn: string | null;
  ean: string | null;
  raw_json: unknown;
  updated_at: string;
  suppliers:
    | {
        id: string;
        name: string | null;
        code: string | null;
        pricing_formula: string | null;
        cost_adjustment_multiplier: number | null;
      }
    | {
        id: string;
        name: string | null;
        code: string | null;
        pricing_formula: string | null;
        cost_adjustment_multiplier: number | null;
      }[]
    | null;
  products: DbMasterProduct;
};

export type SupplierOfferRow = {
  id: string;
  supplier: string;
  supplierCode: string;
  supplierProductId: string;
  productId: string | null;
  masterMatchStatus: string;
  enrichmentStatus: string;
  priceAmount: number | null;
  acquisitionKm: number | null;
  sellingKm: number | null;
  currency: string;
  mpn: string | null;
  ean: string | null;
  matchAudit: {
    result: "linked" | "skipped";
    method: "ean" | "mpn" | "none";
    reason?: string;
    candidateCount?: number;
    normalized?: { ean?: string | null; mpn?: string | null };
    matchedProductId?: string;
  } | null;
  updatedAt: string;
  masterProduct: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
  } | null;
};

export type SupplierOffersListParams = PaginationParams & {
  q?: string;
  supplier?: string;
  matchStatus?: string;
  enrichmentStatus?: string;
  quickFilter?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export type SupplierOffersStats = {
  all: number;
  linked: number;
  unlinked: number;
  pending_review: number;
  failed_enrichment: number;
  missing_identifiers: number;
};

function toSupplier(row: DbSupplier) {
  const value = row == null ? null : Array.isArray(row) ? row[0] ?? null : row;
  return {
    name: value?.name ?? "Unknown",
    code: value?.code ?? "unknown"
  };
}

function toMasterProduct(row: DbMasterProduct) {
  const value = row == null ? null : Array.isArray(row) ? row[0] ?? null : row;
  if (!value?.id) return null;
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    image: value.main_image,
    sellingMarginOverride: value.selling_margin_override ?? null,
    categorySellingMarginDefault:
      (Array.isArray(value.categories)
        ? value.categories[0]?.selling_margin_default
        : value.categories?.selling_margin_default) ?? null
  };
}

function toRow(
  row: DbSupplierProduct,
  resolvedSettings: ReturnType<typeof resolvePricingSettingsRow>["settings"],
  tiers: PricingMarginTierRow[]
): SupplierOfferRow {
  const supplier = toSupplier(row.suppliers);
  const masterProduct = toMasterProduct(row.products);
  const raw =
    row.raw_json && typeof row.raw_json === "object" && !Array.isArray(row.raw_json)
      ? (row.raw_json as Record<string, unknown>)
      : null;
  const matchAuditRaw =
    raw?.matchAudit && typeof raw.matchAudit === "object" && !Array.isArray(raw.matchAudit)
      ? (raw.matchAudit as Record<string, unknown>)
      : null;

  const supplierMeta =
    row.suppliers == null
      ? null
      : Array.isArray(row.suppliers)
        ? row.suppliers[0] ?? null
        : row.suppliers;

  const acquisitionKm =
    row.price_amount != null
      ? computeAcquisitionKm(
          Number(row.price_amount),
          row.currency ?? "",
          {
            id: supplierMeta?.id ?? "",
            pricing_formula: supplierMeta?.pricing_formula ?? null,
            cost_adjustment_multiplier: supplierMeta?.cost_adjustment_multiplier ?? 1
          },
          resolvedSettings
        )
      : null;

  const sellingKm =
    acquisitionKm != null && acquisitionKm > 0
      ? computeFinalSellingKm(
          acquisitionKm,
          resolveSellingMultiplier(
            acquisitionKm,
            tiers,
            resolvedSettings,
            masterProduct?.categorySellingMarginDefault ?? null,
            masterProduct?.sellingMarginOverride ?? null
          ),
          resolvedSettings
        )
      : null;

  return {
    id: row.id,
    supplier: supplier.name,
    supplierCode: supplier.code,
    supplierProductId: row.supplier_product_id,
    productId: row.product_id,
    masterMatchStatus: row.master_match_status ?? "unknown",
    enrichmentStatus: row.enrichment_status ?? "unknown",
    priceAmount: row.price_amount != null ? Number(row.price_amount) : null,
    acquisitionKm,
    sellingKm,
    currency: row.currency ?? "",
    mpn: row.mpn,
    ean: row.ean,
    matchAudit: matchAuditRaw
      ? {
          result: matchAuditRaw.result === "linked" ? "linked" : "skipped",
          method:
            matchAuditRaw.method === "ean" || matchAuditRaw.method === "mpn" || matchAuditRaw.method === "none"
              ? matchAuditRaw.method
              : "none",
          reason: typeof matchAuditRaw.reason === "string" ? matchAuditRaw.reason : undefined,
          candidateCount:
            typeof matchAuditRaw.candidateCount === "number" ? matchAuditRaw.candidateCount : undefined,
          normalized:
            matchAuditRaw.normalized &&
            typeof matchAuditRaw.normalized === "object" &&
            !Array.isArray(matchAuditRaw.normalized)
              ? (matchAuditRaw.normalized as { ean?: string | null; mpn?: string | null })
              : undefined,
          matchedProductId:
            typeof matchAuditRaw.matchedProductId === "string" ? matchAuditRaw.matchedProductId : undefined
        }
      : null,
    updatedAt: row.updated_at,
    masterProduct: masterProduct
      ? {
          id: masterProduct.id,
          name: masterProduct.name,
          slug: masterProduct.slug,
          image: masterProduct.image
        }
      : null
  };
}

const LIST_SELECT =
  "id, supplier_product_id, product_id, master_match_status, enrichment_status, price_amount, currency, mpn, ean, raw_json, updated_at, suppliers(id, name, code, pricing_formula, cost_adjustment_multiplier), products(id, name, slug, main_image, selling_margin_override, categories(selling_margin_default))";

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, "\\$&");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySupplierOffersFilters(query: any, params: Pick<SupplierOffersListParams, "q" | "supplier" | "matchStatus" | "enrichmentStatus" | "quickFilter">) {
  let q = query;

  if (params.supplier && params.supplier !== "all") {
    q = q.eq("suppliers.code", params.supplier);
  }
  if (params.matchStatus && params.matchStatus !== "all") {
    q = q.eq("master_match_status", params.matchStatus);
  }
  if (params.enrichmentStatus && params.enrichmentStatus !== "all") {
    q = q.eq("enrichment_status", params.enrichmentStatus);
  }

  const quick = params.quickFilter ?? "all";
  if (quick === "linked") q = q.not("product_id", "is", null);
  if (quick === "unlinked") q = q.is("product_id", null);
  if (quick === "pending_review") q = q.eq("master_match_status", "pending_review");
  if (quick === "failed_enrichment") q = q.eq("enrichment_status", "failed");
  if (quick === "missing_identifiers") q = q.or("mpn.is.null,ean.is.null");

  const search = params.q?.trim();
  if (search) {
    const pattern = `%${escapeIlike(search)}%`;
    q = q.or(
      [
        `supplier_product_id.ilike.${pattern}`,
        `mpn.ilike.${pattern}`,
        `ean.ilike.${pattern}`,
        `products.name.ilike.${pattern}`,
        `products.slug.ilike.${pattern}`
      ].join(",")
    );
  }

  return q;
}

function resolveSortColumn(sortBy?: string): string {
  switch (sortBy) {
    case "priceSort":
    case "priceAmount":
      return "price_amount";
    case "supplierProductId":
      return "supplier_product_id";
    case "masterMatchStatus":
      return "master_match_status";
    case "enrichmentStatus":
      return "enrichment_status";
    case "mpn":
      return "mpn";
    case "ean":
      return "ean";
    case "updatedAt":
    default:
      return "updated_at";
  }
}

async function loadPricingContext(supabase: SupabaseClient) {
  const { data: settingsRows } = await supabase.from("pricing_settings").select("*").limit(1);
  const { data: tierRows, error: tiersError } = await supabase
    .from("pricing_margin_tiers")
    .select("id, min_cost_km, max_cost_km, margin_multiplier, sort_order")
    .order("min_cost_km", { ascending: true })
    .order("sort_order", { ascending: true });
  if (tiersError) throw new Error(tiersError.message);
  const { settings } = resolvePricingSettingsRow((settingsRows?.[0] ?? null) as PricingSettingsRow | null);
  return { settings, tiers: (tierRows ?? []) as PricingMarginTierRow[] };
}

export async function listSupplierOffers(
  supabase: SupabaseClient,
  params: SupplierOffersListParams
): Promise<PaginatedResult<SupplierOfferRow>> {
  const { settings, tiers } = await loadPricingContext(supabase);
  const sortColumn = resolveSortColumn(params.sortBy);
  const ascending = params.sortDir === "asc";

  let countQuery = supabase
    .from("supplier_products")
    .select("id", { count: "exact", head: true });
  countQuery = applySupplierOffersFilters(countQuery, params);
  const { count, error: countError } = await countQuery;
  if (countError) throw new Error(countError.message);

  const total = count ?? 0;
  const offset = (params.page - 1) * params.limit;

  let dataQuery = supabase.from("supplier_products").select(LIST_SELECT);
  dataQuery = applySupplierOffersFilters(dataQuery, params);
  const { data, error } = await dataQuery
    .order(sortColumn, { ascending })
    .range(offset, offset + params.limit - 1);

  if (error) throw new Error(error.message);

  const items = ((data ?? []) as DbSupplierProduct[]).map((row) => toRow(row, settings, tiers));
  return buildPaginatedResult(items, total, params.page, params.limit);
}

async function countWithQuickFilter(
  supabase: SupabaseClient,
  quickFilter: string
): Promise<number> {
  let query = supabase.from("supplier_products").select("id", { count: "exact", head: true });
  query = applySupplierOffersFilters(query, { quickFilter });
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getSupplierOffersStats(supabase: SupabaseClient): Promise<SupplierOffersStats> {
  const [all, linked, unlinked, pending_review, failed_enrichment, missing_identifiers] =
    await Promise.all([
      countWithQuickFilter(supabase, "all"),
      countWithQuickFilter(supabase, "linked"),
      countWithQuickFilter(supabase, "unlinked"),
      countWithQuickFilter(supabase, "pending_review"),
      countWithQuickFilter(supabase, "failed_enrichment"),
      countWithQuickFilter(supabase, "missing_identifiers")
    ]);

  return { all, linked, unlinked, pending_review, failed_enrichment, missing_identifiers };
}

export async function getSupplierOffersFilterOptions(supabase: SupabaseClient) {
  const { data: suppliers, error: suppliersError } = await supabase
    .from("suppliers")
    .select("code")
    .order("code", { ascending: true });
  if (suppliersError) throw new Error(suppliersError.message);

  const supplierCodes = Array.from(
    new Set((suppliers ?? []).map((row) => String(row.code ?? "").trim()).filter(Boolean))
  ).sort();

  const matchStatuses = ["linked", "pending_review", "unknown"];
  const enrichmentStatuses = ["complete", "failed", "processing", "unknown"];

  return { supplierCodes, matchStatuses, enrichmentStatuses };
}
