import { NextResponse } from "next/server";
import { getAuthUser } from "lib/auth/session";
import { addToWishlist } from "lib/wishlist/wishlist-service";

type Body = { productId?: unknown };

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Body;
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    await addToWishlist(user.id, productId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
