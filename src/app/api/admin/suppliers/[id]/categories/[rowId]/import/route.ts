import { NextResponse } from "next/server";
import { withJobRun } from "lib/jobs/job-runner";
import {
  IPON_SUPPLIER_ID,
  runIponImportForSupplierCategory
} from "lib/suppliers/ipon/importProducts";
import { guardAdminApi } from "lib/auth/admin-route";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; rowId: string }> }
) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id: supplierId, rowId } = await context.params;

    if (supplierId !== IPON_SUPPLIER_ID) {
      return NextResponse.json(
        { error: "Ručni import po kategoriji je trenutno podržan samo za iPon." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();
    const { data: row, error } = await supabase
      .from("supplier_categories")
      .select(
        "id, internal_category_id, supplier_category_key, listing_url, categories(name, slug)"
      )
      .eq("id", rowId)
      .eq("supplier_id", supplierId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!row) return NextResponse.json({ error: "Category row not found." }, { status: 404 });

    const listingUrl = row.listing_url?.trim() ?? "";
    if (!listingUrl) {
      return NextResponse.json(
        { error: "Listing URL nije postavljen za ovaj red — dodaj URL prije importa." },
        { status: 400 }
      );
    }

    const categoryJoin = row.categories as
      | { name: string; slug: string }
      | { name: string; slug: string }[]
      | null;
    const categoryMeta = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;
    const categoryName = categoryMeta?.name ?? categoryMeta?.slug ?? row.internal_category_id;

    const { runId, value } = await withJobRun(
      {
        jobType: "ipon_import",
        supplierId,
        triggeredBy: "manual",
        initialSummary: {
          single_category: true,
          supplier_category_row_id: rowId,
          category_name: categoryName,
          internal_category_id: row.internal_category_id
        }
      },
      async () =>
        runIponImportForSupplierCategory({
          internalCategoryId: row.internal_category_id,
          listingUrl,
          supplierCategoryKey: row.supplier_category_key,
          name: categoryName
        })
    );

    return NextResponse.json({ success: true, runId, result: value });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/suppliers/categories/import]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
