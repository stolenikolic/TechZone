import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

type Body = { ids?: unknown };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ prices: [] });
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

    const prices = (data ?? [])
      .map((row) => ({
        id: String(row.id),
        price: row.custom_price != null ? Number(row.custom_price) : Number(row.price)
      }))
      .filter((row) => Number.isFinite(row.price) && row.price >= 0);

    return NextResponse.json({ prices });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
