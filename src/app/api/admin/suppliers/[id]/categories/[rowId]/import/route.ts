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
import { runPclandImportForSupplierCategory } from "lib/suppliers/pcland/importProducts";
import { PCLAND_SUPPLIER_ID } from "lib/suppliers/pcland/constants";
import { runOazisImportForSupplierCategory } from "lib/suppliers/oazis/importProducts";
import { OAZIS_SUPPLIER_ID } from "lib/suppliers/oazis/constants";
import { runKonzolvilagImportForSupplierCategory } from "lib/suppliers/konzolvilag/importProducts";
import { KONZOLVILAG_SUPPLIER_ID } from "lib/suppliers/konzolvilag/constants";
import { runComtradeImportForSupplierCategory } from "lib/suppliers/comtrade/importProducts";
import { COMTRADE_SUPPLIER_ID } from "lib/suppliers/comtrade/constants";
import { runAvteraImportForSupplierCategory } from "lib/suppliers/avtera/importProducts";
import { AVTERA_SUPPLIER_ID } from "lib/suppliers/avtera/constants";
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
      supplierId !== FIRSTSHOP_SUPPLIER_ID &&
      supplierId !== PCLAND_SUPPLIER_ID &&
      supplierId !== OAZIS_SUPPLIER_ID &&
      supplierId !== KONZOLVILAG_SUPPLIER_ID &&
      supplierId !== COMTRADE_SUPPLIER_ID &&
      supplierId !== AVTERA_SUPPLIER_ID
    ) {
      return NextResponse.json(
        {
          error:
            "Ručni import po kategoriji je podržan samo za iPon, PCX, FirstShop, PCLand, Oázis, Konzolvilág, ComTrade i Avtera."
        },
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

    const isComtrade = supplierId === COMTRADE_SUPPLIER_ID;
    const isAvtera = supplierId === AVTERA_SUPPLIER_ID;
    const listingUrl = row.listing_url?.trim() ?? "";
    const productGroupId = row.supplier_category_key?.trim() ?? "";

    if (isComtrade || isAvtera) {
      if (!productGroupId) {
        return NextResponse.json(
          {
            error: isComtrade
              ? "supplier_category_key (ComTrade productGroupID, npr. CPU) nije postavljen za ovaj red."
              : "supplier_category_key (Avtera kategorija/@id, npr. MS) nije postavljen za ovaj red."
          },
          { status: 400 }
        );
      }
    } else if (!listingUrl) {
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
    const isPcland = supplierId === PCLAND_SUPPLIER_ID;
    const isOazis = supplierId === OAZIS_SUPPLIER_ID;
    const isKonzolvilag = supplierId === KONZOLVILAG_SUPPLIER_ID;
    const categoryKey =
      row.supplier_category_key?.trim() || categoryMeta?.slug || categoryName;

    const { runId, value } = await withJobRun(
      {
        jobType: isComtrade
          ? "comtrade_import"
          : isAvtera
            ? "avtera_import"
            : isKonzolvilag
            ? "konzolvilag_import"
            : isOazis
              ? "oazis_import"
              : isPcland
                ? "pcland_import"
                : isFirstshop
                  ? "firstshop_import"
                  : isPcx
                    ? "pcx_import"
                    : "ipon_import",
        supplierId,
        triggeredBy: "manual",
        initialSummary: {
          single_category: true,
          supplier_category_row_id: rowId,
          category_name: categoryName,
          internal_category_id: row.internal_category_id,
          ...(isComtrade ? { product_group_id: productGroupId } : {}),
          ...(isAvtera ? { category_id: productGroupId } : {})
        }
      },
      async () => {
        if (isComtrade) {
          return runComtradeImportForSupplierCategory({
            productGroupId,
            internalCategoryId: row.internal_category_id,
            name: categoryName
          });
        }
        if (isAvtera) {
          return runAvteraImportForSupplierCategory({
            categoryId: productGroupId,
            internalCategoryId: row.internal_category_id,
            name: categoryName
          });
        }
        if (isKonzolvilag) {
          return runKonzolvilagImportForSupplierCategory({
            listingUrl,
            categoryKey,
            name: categoryName
          });
        }
        if (isOazis) {
          return runOazisImportForSupplierCategory({
            listingUrl,
            categoryKey,
            name: categoryName
          });
        }
        if (isPcland) {
          return runPclandImportForSupplierCategory({
            listingUrl,
            categoryKey,
            name: categoryName
          });
        }
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
