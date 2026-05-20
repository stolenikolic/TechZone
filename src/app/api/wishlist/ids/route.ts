import { NextResponse } from "next/server";
import { getAuthUser } from "lib/auth/session";
import { getWishlistIdsForUser } from "lib/wishlist/wishlist-service";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ids = await getWishlistIdsForUser(user.id);
    return NextResponse.json({ ids });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
