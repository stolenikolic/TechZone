import { NextResponse } from "next/server";
import { resolveCartOfferPrices } from "lib/cart/offer-pricing";
import { createSupabaseServiceClient } from "utils/supabase";

type LineInput = {
  lineId?: unknown;
  productId?: unknown;
  supplierProductId?: unknown;
};

type Body = {
  lines?: unknown;
  /** @deprecated Legacy product-only ids — ignored when lines present */
  ids?: unknown;
};

function parseLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const line = row as LineInput;
      const lineId = typeof line.lineId === "string" ? line.lineId.trim() : "";
      const productId = typeof line.productId === "string" ? line.productId.trim() : "";
      const supplierProductId =
        typeof line.supplierProductId === "string" ? line.supplierProductId.trim() : "";
      if (!lineId || !productId || !supplierProductId) return null;
      return { lineId, productId, supplierProductId };
    })
    .filter((line): line is { lineId: string; productId: string; supplierProductId: string } => line != null);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const lines = parseLines(body.lines);

    if (lines.length === 0) {
      return NextResponse.json({ prices: [], unavailableIds: [] });
    }

    const supabase = createSupabaseServiceClient();
    const { prices, unavailableIds, metaByLineId } = await resolveCartOfferPrices(supabase, lines);

    const pricesWithDelivery = prices.map((row) => {
      const meta = metaByLineId.get(row.id);
      if (!meta) return row;
      return {
        ...row,
        estimatedDeliveryDate: meta.estimatedDeliveryDate,
        deliveryLabel: `Rok isporuke: ${meta.deliveryLabel.replace(/^Procijenjena isporuka: /, "")}`
      };
    });

    return NextResponse.json({ prices: pricesWithDelivery, unavailableIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
