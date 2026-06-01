import { NextResponse } from "next/server";
import { getAuthUser } from "lib/auth/session";
import { mergeGuestCart } from "lib/cart/cart-service";

type Body = { items?: unknown };

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Body;
    const items = Array.isArray(body.items)
      ? body.items.filter(
          (row): row is { id: string; qty: number } =>
            row != null &&
            typeof row === "object" &&
            typeof (row as { id?: unknown }).id === "string" &&
            (row as { id: string }).id.trim().length > 0 &&
            typeof (row as { qty?: unknown }).qty === "number" &&
            Number.isFinite((row as { qty: number }).qty)
        )
      : [];

    await mergeGuestCart(user.id, items);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
