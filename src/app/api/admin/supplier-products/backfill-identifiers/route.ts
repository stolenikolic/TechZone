import { NextResponse } from "next/server";
import { getIdentifierSyncUpdate } from "lib/suppliers/syncSupplierIdentifiers";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

type LinkedSupplierRow = {
  id: string;
  product_id: string;
  mpn: string | null;
  ean: string | null;
  products:
    | { mpn: string | null; ean: string | null }
    | { mpn: string | null; ean: string | null }[]
    | null;
};

const PAGE_SIZE = 500;

function firstProduct(value: LinkedSupplierRow["products"]) {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function POST() {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const supabase = createSupabaseServiceClient();
    let cursor: string | null = null;
    let scanned = 0;
    let updated = 0;
    let unchanged = 0;

    for (;;) {
      let query = supabase
        .from("supplier_products")
        .select("id, product_id, mpn, ean, products(mpn, ean)")
        .not("product_id", "is", null)
        .or("mpn.is.null,ean.is.null")
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);

      if (cursor) query = query.gt("id", cursor);

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      const page = (data ?? []) as LinkedSupplierRow[];
      if (page.length === 0) break;

      for (const row of page) {
        scanned += 1;
        const product = firstProduct(row.products);
        const sync = getIdentifierSyncUpdate(
          { mpn: row.mpn, ean: row.ean },
          { mpn: product?.mpn ?? null, ean: product?.ean ?? null }
        );
        if (Object.keys(sync.update).length === 0) {
          unchanged += 1;
          continue;
        }

        const { error: updateError } = await supabase
          .from("supplier_products")
          .update({ ...sync.update, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 400 });
        }
        updated += 1;
      }

      cursor = page[page.length - 1]?.id ?? cursor;
      if (page.length < PAGE_SIZE) break;
    }

    return NextResponse.json({ success: true, scanned, updated, unchanged });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/supplier-products/backfill-identifiers]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
