import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCartLineId } from "lib/cart/cart-line-id";
import { createSupabaseServiceClient } from "utils/supabase";

async function findCheapestSupplierProductId(
  supabase: SupabaseClient,
  productId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("supplier_products")
    .select("id, price_amount")
    .eq("product_id", productId)
    .eq("is_active", true)
    .not("price_amount", "is", null)
    .order("price_amount", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId")?.trim() ?? "";
    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const supplierProductId = await findCheapestSupplierProductId(supabase, productId);
    if (!supplierProductId) {
      return NextResponse.json({ error: "No active offer" }, { status: 404 });
    }

    const { resolveCartOfferPrices } = await import("lib/cart/offer-pricing");
    const lineId = buildCartLineId(productId, supplierProductId);
    const { prices, unavailableIds, metaByLineId } = await resolveCartOfferPrices(supabase, [
      { lineId, productId, supplierProductId }
    ]);

    if (unavailableIds.includes(lineId)) {
      return NextResponse.json({ error: "Offer unavailable" }, { status: 404 });
    }

    const priceRow = prices.find((p) => p.id === lineId);
    const meta = metaByLineId.get(lineId);
    if (!priceRow || !meta) {
      return NextResponse.json({ error: "Offer unavailable" }, { status: 404 });
    }

    return NextResponse.json({
      supplierProductId,
      sellingPrice: priceRow.price,
      originalPrice: priceRow.originalPrice,
      offerChoice: meta.offerChoice,
      deliveryLabel: meta.deliveryLabel,
      estimatedDeliveryDate: meta.estimatedDeliveryDate
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
