import { NextResponse } from "next/server";
import { getAuthUser } from "lib/auth/session";
import { clearCartForUser, getCartForUser, replaceCartForUser } from "lib/cart/cart-service";

type Body = { items?: unknown };

function parseItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is { id: string; qty: number } =>
      row != null &&
      typeof row === "object" &&
      typeof (row as { id?: unknown }).id === "string" &&
      (row as { id: string }).id.trim().length > 0 &&
      typeof (row as { qty?: unknown }).qty === "number" &&
      Number.isFinite((row as { qty: number }).qty)
  );
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await getCartForUser(user.id);
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Body;
    const items = parseItems(body.items);
    await replaceCartForUser(user.id, items);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await clearCartForUser(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
