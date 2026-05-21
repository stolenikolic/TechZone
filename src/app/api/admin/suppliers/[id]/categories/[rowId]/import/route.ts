import { NextResponse } from "next/server";
import { withJobRun } from "lib/jobs/job-runner";
import {
  IPON_SUPPLIER_ID,
  runIponImportForSupplierCategory
} from "lib/suppliers/ipon/importProducts";
import {
  PCX_SUPPLIER_ID,
  runPcxImportForSupplierCategory
} from "lib/suppliers/pcx/importProducts";
import { runFirstshopImportForSupplierCategory } from "lib/suppliers/firstshop/importProducts";
import { FIRSTSHOP_SUPPLIER_ID } from "lib/suppliers/firstshop/constants";
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

    if (
      supplierId !== IPON_SUPPLIER_ID &&
      supplierId !== PCX_SUPPLIER_ID &&
      supplierId !== FIRSTSHOP_SUPPLIER_ID
    ) {
      return NextResponse.json(
        { error: "Ručni import po kategoriji je podržan samo za iPon, PCX i FirstShop." },
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

    const isPcx = supplierId === PCX_SUPPLIER_ID;
    const isFirstshop = supplierId === FIRSTSHOP_SUPPLIER_ID;
    const categoryKey =
      row.supplier_category_key?.trim() || categoryMeta?.slug || categoryName;

    const { runId, value } = await withJobRun(
      {
        jobType: isFirstshop ? "firstshop_import" : isPcx ? "pcx_import" : "ipon_import",
        supplierId,
        triggeredBy: "manual",
        initialSummary: {
          single_category: true,
          supplier_category_row_id: rowId,
          category_name: categoryName,
          internal_category_id: row.internal_category_id
        }
      },
      async () => {
        if (isFirstshop) {
          return runFirstshopImportForSupplierCategory({
            listingUrl,
            categoryKey,
            name: categoryName
          });
        }
        if (isPcx) {
          return runPcxImportForSupplierCategory({
            listingUrl,
            name: categoryName
          });
        }
        return runIponImportForSupplierCategory({
          internalCategoryId: row.internal_category_id,
          listingUrl,
          supplierCategoryKey: row.supplier_category_key,
          name: categoryName
        });
      }
    );

    return NextResponse.json({ success: true, runId, result: value });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/suppliers/categories/import]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
