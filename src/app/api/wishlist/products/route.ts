import { NextResponse } from "next/server";
import { getWishlistProductsByIds } from "lib/wishlist/wishlist-service";

type Body = { ids?: unknown };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    const products = await getWishlistProductsByIds(ids);
    return NextResponse.json({ products });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
