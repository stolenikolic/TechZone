import { NextResponse } from "next/server";
import { createOrder } from "lib/orders/orders-service";
import { getAuthUser } from "lib/auth/session";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const user = await getAuthUser();
    const order = await createOrder(payload, user?.id ?? null);

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create order.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
