import { NextResponse } from "next/server";
import { getEffectivePrice } from "lib/effective-price";
import { createSupabaseServiceClient } from "utils/supabase";

type Body = { ids?: unknown };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ prices: [], unavailableIds: [] });
    }

    const uniqueIds = Array.from(new Set(ids));
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, price, custom_price")
      .in("id", uniqueIds)
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const availableIds = new Set(rows.map((row) => String(row.id)));
    const unavailableIds = uniqueIds.filter((id) => !availableIds.has(id));
    const prices = rows
      .map((row) => ({
        id: String(row.id),
        price: getEffectivePrice(row.custom_price, row.price)
      }))
      .filter((row) => Number.isFinite(row.price) && row.price >= 0);

    return NextResponse.json({ prices, unavailableIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
