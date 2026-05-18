import { NextResponse } from "next/server";
import { updateOrderStatus } from "lib/orders/orders-service";
import type { OrderStatus } from "models/Order.model";
import { guardAdminApi } from "lib/auth/admin-route";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await guardAdminApi();
  if (denied) return denied;
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
