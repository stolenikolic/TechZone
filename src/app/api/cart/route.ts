import { NextResponse } from "next/server";
import { getAuthUser } from "lib/auth/session";
import { clearCartForUser, getCartForUser, replaceCartForUser } from "lib/cart/cart-service";

type Body = { items?: unknown };

function parseItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (row == null || typeof row !== "object") return null;
      const item = row as {
        id?: unknown;
        productId?: unknown;
        supplierProductId?: unknown;
        qty?: unknown;
      };
      const qty = typeof item.qty === "number" ? item.qty : Number(item.qty);
      if (!Number.isFinite(qty)) return null;

      const productId = typeof item.productId === "string" ? item.productId.trim() : "";
      const supplierProductId =
        typeof item.supplierProductId === "string" ? item.supplierProductId.trim() : "";

      if (productId && supplierProductId) {
        return { productId, supplierProductId, qty };
      }

      if (typeof item.id === "string" && item.id.includes(":")) {
        return { id: item.id, qty };
      }

      return null;
    })
    .filter(
      (
        row
      ): row is
        | { productId: string; supplierProductId: string; qty: number }
        | { id: string; qty: number } => row != null
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
