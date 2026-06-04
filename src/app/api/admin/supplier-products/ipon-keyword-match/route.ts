import { NextResponse } from "next/server";
import { guardAdminApi } from "lib/auth/admin-route";
import { lookupIponByKeyword } from "lib/suppliers/ipon/ipon-keyword-match";
import { createSupabaseServiceClient } from "utils/supabase";

export const maxDuration = 300;

type Body = {
  categoryId?: string | null;
};

type SupplierCandidateRow = {
  id: string;
  supplier_product_id: string;
  mpn: string | null;
  raw_json: unknown;
  suppliers:
    | {
        code: string | null;
      }
    | {
        code: string | null;
      }[]
    | null;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
};

type MatchRowResult = {
  supplierProductId: string;
  rawProductName: string | null;
  iponProductName: string;
  matchedMasterName: string;
  matchedMasterSlug: string;
};

async function insertEvent(
  runId: string,
  level: "info" | "warn" | "error",
  message: string,
  details?: { supplierProductId?: string; matchedProductId?: string }
) {
  const supabase = createSupabaseServiceClient();
  await supabase.from("match_run_events").insert({
    run_id: runId,
    level,
    message,
    supplier_product_id: details?.supplierProductId ?? null,
    matched_product_id: details?.matchedProductId ?? null
  });
}

function toSupplierCode(value: SupplierCandidateRow["suppliers"]): string | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] ?? null : value;
  return row?.code ?? null;
}

function extractRawProductName(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const candidates = [row.product_name, row.displayName, row.productName, row.fullName, row.name];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function mergeIponKeywordAudit(raw: unknown, detail: {
  keyword: string;
  candidateCount: number;
  iponSlug: string;
  iponDisplayName: string;
  matchedProductId: string;
}) {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    ...base,
    matchAudit: {
      result: "linked",
      method: "ipon_keyword_slug_manual",
      candidateCount: detail.candidateCount,
      normalized: { mpn: detail.keyword, ean: null },
      matchedProductId: detail.matchedProductId,
      iponSlug: detail.iponSlug,
      iponDisplayName: detail.iponDisplayName
    }
  };
}

export async function POST(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const categoryId = typeof body.categoryId === "string" && body.categoryId.trim() ? body.categoryId.trim() : null;

    const supabase = createSupabaseServiceClient();
    const { data: runInsert, error: runInsertError } = await supabase
      .from("match_runs")
      .insert({ source: "ipon_keyword_manual", status: "running" })
      .select("id")
      .single();

    if (runInsertError || !runInsert?.id) {
      return NextResponse.json(
        { error: runInsertError?.message ?? "Failed to create match run for IPON keyword matcher." },
        { status: 500 }
      );
    }
    const runId = runInsert.id as string;
    await insertEvent(runId, "info", "IPON keyword match run started.");

    const { data, error } = await supabase
      .from("supplier_products")
      .select("id, supplier_product_id, mpn, raw_json, suppliers!inner(code)")
      .is("product_id", null)
      .not("mpn", "is", null)
      .neq("suppliers.code", "ipon")
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (error) {
      await insertEvent(runId, "error", `Failed to load supplier candidates: ${error.message}`);
      await supabase
        .from("match_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          scanned: 0,
          linked: 0,
          skipped: 0,
          errors_count: 1
        })
        .eq("id", runId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const candidates = ((data ?? []) as SupplierCandidateRow[]).filter(
      (row) => (toSupplierCode(row.suppliers) ?? "").toLowerCase() !== "ipon"
    );

    let scanned = 0;
    let linked = 0;
    let skippedNoMpn = 0;
    let skippedNoResult = 0;
    let skippedAmbiguous = 0;
    let skippedNoMasterBySlug = 0;
    let skippedCategoryMismatch = 0;
    let errors = 0;
    const matches: MatchRowResult[] = [];

    for (const row of candidates) {
      const mpn = row.mpn?.trim() ?? "";
      if (!mpn) {
        skippedNoMpn += 1;
        continue;
      }

      scanned += 1;
      const keywordResult = await lookupIponByKeyword(mpn);

      if (keywordResult.status === "error") {
        errors += 1;
        await insertEvent(runId, "error", `IPON API error for keyword "${mpn}".`, {
          supplierProductId: row.supplier_product_id
        });
        continue;
      }
      if (keywordResult.status === "empty") {
        skippedNoResult += 1;
        await insertEvent(runId, "warn", `No IPON candidate for keyword "${mpn}".`, {
          supplierProductId: row.supplier_product_id
        });
        continue;
      }
      if (keywordResult.status === "ambiguous") {
        skippedAmbiguous += 1;
        await insertEvent(
          runId,
          "warn",
          `Ambiguous IPON keyword result (${keywordResult.total} candidates) for "${mpn}".`,
          { supplierProductId: row.supplier_product_id }
        );
        continue;
      }

      const slug = keywordResult.item.slug;
      const { data: master, error: masterError } = await supabase
        .from("products")
        .select("id, name, slug, category_id")
        .eq("slug", slug)
        .maybeSingle();

      if (masterError) {
        errors += 1;
        await insertEvent(runId, "error", `Master lookup failed for slug "${slug}": ${masterError.message}`, {
          supplierProductId: row.supplier_product_id
        });
        continue;
      }

      const product = master as ProductRow | null;
      if (!product?.id) {
        skippedNoMasterBySlug += 1;
        await insertEvent(runId, "warn", `No master product found by IPON slug "${slug}".`, {
          supplierProductId: row.supplier_product_id
        });
        continue;
      }

      if (categoryId && product.category_id !== categoryId) {
        skippedCategoryMismatch += 1;
        await insertEvent(runId, "warn", `Category mismatch for master "${product.name}" (${product.slug}).`, {
          supplierProductId: row.supplier_product_id,
          matchedProductId: product.id
        });
        continue;
      }

      const patchedRaw = mergeIponKeywordAudit(row.raw_json, {
        keyword: mpn,
        candidateCount: keywordResult.total,
        iponSlug: keywordResult.item.slug,
        iponDisplayName: keywordResult.item.displayName,
        matchedProductId: product.id
      });

      const { error: updateError } = await supabase
        .from("supplier_products")
        .update({
          product_id: product.id,
          master_match_status: "linked",
          raw_json: patchedRaw,
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id);

      if (updateError) {
        errors += 1;
        await insertEvent(runId, "error", `Supplier offer update failed: ${updateError.message}`, {
          supplierProductId: row.supplier_product_id,
          matchedProductId: product.id
        });
        continue;
      }

      linked += 1;
      await insertEvent(
        runId,
        "info",
        `LINKED IPON KEYWORD | RAW: ${extractRawProductName(row.raw_json) ?? "-"} | MASTER: ${product.name} (${product.slug})`,
        {
          supplierProductId: row.supplier_product_id,
          matchedProductId: product.id
        }
      );
      matches.push({
        supplierProductId: row.supplier_product_id,
        rawProductName: extractRawProductName(row.raw_json),
        iponProductName: keywordResult.item.displayName,
        matchedMasterName: product.name,
        matchedMasterSlug: product.slug
      });
    }

    const skipped = scanned - linked;
    await supabase
      .from("match_runs")
      .update({
        status: errors > 0 ? "failed" : "success",
        finished_at: new Date().toISOString(),
        scanned,
        linked,
        skipped,
        errors_count: errors
      })
      .eq("id", runId);
    await insertEvent(
      runId,
      "info",
      `IPON keyword match run finished. scanned=${scanned}, linked=${linked}, skipped=${skipped}, errors=${errors}.`
    );

    return NextResponse.json({
      success: errors === 0,
      runId,
      scanned,
      linked,
      skippedNoMpn,
      skippedNoResult,
      skippedAmbiguous,
      skippedNoMasterBySlug,
      skippedCategoryMismatch,
      errors,
      matches
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        scanned: 0,
        linked: 0,
        skippedNoMpn: 0,
        skippedNoResult: 0,
        skippedAmbiguous: 0,
        skippedNoMasterBySlug: 0,
        skippedCategoryMismatch: 0,
        errors: 1,
        matches: [],
        error: message
      },
      { status: 500 }
    );
  }
}
