import { NextResponse } from "next/server";
import { getAuthUser } from "lib/auth/session";
import { removeFromWishlist } from "lib/wishlist/wishlist-service";

type Params = { params: Promise<{ productId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { productId } = await params;
    if (!productId?.trim()) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    await removeFromWishlist(user.id, productId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
