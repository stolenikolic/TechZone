import { NextResponse } from "next/server";
import { createOrder } from "lib/orders/orders-service";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const order = await createOrder(payload);

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create order.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
