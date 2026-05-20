import { NextResponse } from "next/server";
import { getAuthUser } from "lib/auth/session";
import { mergeGuestWishlist } from "lib/wishlist/wishlist-service";

type Body = { productIds?: unknown };

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Body;
    const productIds = Array.isArray(body.productIds)
      ? body.productIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    await mergeGuestWishlist(user.id, productIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
