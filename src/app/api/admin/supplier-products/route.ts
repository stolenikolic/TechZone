import { NextResponse } from "next/server";
import {
  computeFinalSellingKm,
  computeAcquisitionKm,
  resolvePricingSettingsRow,
  resolveSellingMultiplier,
  type PricingMarginTierRow,
  type PricingSettingsRow
} from "lib/pricing";
import { createSupabaseServiceClient } from "utils/supabase";

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
    | { id: string; name: string | null; code: string | null; pricing_formula: string | null; cost_adjustment_multiplier: number | null }
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
  rawJson: unknown;
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
      (Array.isArray(value.categories) ? value.categories[0]?.selling_margin_default : value.categories?.selling_margin_default) ?? null
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
    rawJson: row.raw_json,
    matchAudit: matchAuditRaw
      ? {
          result: matchAuditRaw.result === "linked" ? "linked" : "skipped",
          method:
            matchAuditRaw.method === "ean" || matchAuditRaw.method === "mpn" || matchAuditRaw.method === "none"
              ? matchAuditRaw.method
              : "none",
          reason: typeof matchAuditRaw.reason === "string" ? matchAuditRaw.reason : undefined,
          candidateCount: typeof matchAuditRaw.candidateCount === "number" ? matchAuditRaw.candidateCount : undefined,
          normalized:
            matchAuditRaw.normalized &&
            typeof matchAuditRaw.normalized === "object" &&
            !Array.isArray(matchAuditRaw.normalized)
              ? (matchAuditRaw.normalized as { ean?: string | null; mpn?: string | null })
              : undefined,
          matchedProductId: typeof matchAuditRaw.matchedProductId === "string" ? matchAuditRaw.matchedProductId : undefined
        }
      : null,
    updatedAt: row.updated_at,
    masterProduct
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();
    const { data: settingsRows } = await supabase.from("pricing_settings").select("*").limit(1);
    const { data: tierRows, error: tiersError } = await supabase
      .from("pricing_margin_tiers")
      .select("id, min_cost_km, max_cost_km, margin_multiplier, sort_order")
      .order("min_cost_km", { ascending: true })
      .order("sort_order", { ascending: true });
    if (tiersError) {
      console.error("[admin/supplier-products]", tiersError.message);
      return NextResponse.json([], { status: 200 });
    }
    const { settings } = resolvePricingSettingsRow((settingsRows?.[0] ?? null) as PricingSettingsRow | null);
    const tiers = (tierRows ?? []) as PricingMarginTierRow[];
    const pageSize = 1000;
    const rows: DbSupplierProduct[] = [];
    let offset = 0;

    for (;;) {
      const { data, error } = await supabase
        .from("supplier_products")
        .select(
          "id, supplier_product_id, product_id, master_match_status, enrichment_status, price_amount, currency, mpn, ean, raw_json, updated_at, suppliers(id, name, code, pricing_formula, cost_adjustment_multiplier), products(id, name, slug, main_image, selling_margin_override, categories(selling_margin_default))"
        )
        .order("updated_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error("[admin/supplier-products]", error.message);
        return NextResponse.json([], { status: 200 });
      }

      const page = (data ?? []) as DbSupplierProduct[];
      rows.push(...page);

      if (page.length < pageSize) break;
      offset += page.length;
    }

    return NextResponse.json(rows.map((row) => toRow(row, settings, tiers)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/supplier-products]", message);
    return NextResponse.json([], { status: 200 });
  }
}
