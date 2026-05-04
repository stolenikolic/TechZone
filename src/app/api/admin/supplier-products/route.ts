import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

type DbSupplier = { name: string | null; code: string | null } | { name: string | null; code: string | null }[] | null;
type DbMasterProduct =
  | { id: string; name: string; slug: string; main_image: string | null }
  | { id: string; name: string; slug: string; main_image: string | null }[]
  | null;

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
  suppliers: DbSupplier;
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
    image: value.main_image
  };
}

function toRow(row: DbSupplierProduct): SupplierOfferRow {
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

  return {
    id: row.id,
    supplier: supplier.name,
    supplierCode: supplier.code,
    supplierProductId: row.supplier_product_id,
    productId: row.product_id,
    masterMatchStatus: row.master_match_status ?? "unknown",
    enrichmentStatus: row.enrichment_status ?? "unknown",
    priceAmount: row.price_amount != null ? Number(row.price_amount) : null,
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
    const pageSize = 1000;
    const rows: DbSupplierProduct[] = [];
    let offset = 0;

    for (;;) {
      const { data, error } = await supabase
        .from("supplier_products")
        .select(
          "id, supplier_product_id, product_id, master_match_status, enrichment_status, price_amount, currency, mpn, ean, raw_json, updated_at, suppliers(name, code), products(id, name, slug, main_image)"
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

    return NextResponse.json(rows.map(toRow));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/supplier-products]", message);
    return NextResponse.json([], { status: 200 });
  }
}
