import { NextResponse } from "next/server";
import { updateOrderStatus } from "lib/orders/orders-service";
import type { OrderStatus } from "models/Order.model";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { status } = (await request.json()) as { status?: OrderStatus };

    if (!status) {
      return NextResponse.json({ error: "Order status is required." }, { status: 400 });
    }

    const order = await updateOrderStatus(id, status);

    return NextResponse.json(order);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update order.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
