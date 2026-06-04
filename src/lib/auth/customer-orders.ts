import { mapDbOrderToOrder } from "lib/orders/orders-service";
import { createSupabaseServiceClient } from "utils/supabase";
import type Order from "models/Order.model";

const PAGE_SIZE = 10;

export async function getOrdersForUser(userId: string, page = 1) {
  const supabase = createSupabaseServiceClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("orders")
    .select(
      `
      id,
      status,
      payment_method,
      customer_name,
      customer_email,
      customer_phone,
      shipping_company,
      shipping_city,
      shipping_country,
      shipping_zip,
      shipping_address1,
      shipping_address2,
      delivery_notes,
      subtotal,
      shipping_total,
      tax_total,
      discount_total,
      total_price,
      created_at,
      updated_at,
      order_items (
        id,
        product_id,
        product_name,
        product_slug,
        product_image,
        quantity,
        unit_price,
        line_total,
        supplier_product_id,
        offer_choice,
        offer_label,
        supplier_name,
        delivery_label
      )
    `,
      { count: "exact" }
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  const orders: Order[] = (data ?? []).map((row) => mapDbOrderToOrder(row as Parameters<typeof mapDbOrderToOrder>[0]));
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return { orders, totalPages };
}

export async function getOrderForUser(userId: string, orderId: string) {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      status,
      payment_method,
      customer_name,
      customer_email,
      customer_phone,
      shipping_company,
      shipping_city,
      shipping_country,
      shipping_zip,
      shipping_address1,
      shipping_address2,
      delivery_notes,
      subtotal,
      shipping_total,
      tax_total,
      discount_total,
      total_price,
      created_at,
      updated_at,
      order_items (
        id,
        product_id,
        product_name,
        product_slug,
        product_image,
        quantity,
        unit_price,
        line_total,
        supplier_product_id,
        offer_choice,
        offer_label,
        supplier_name,
        delivery_label
      )
    `
    )
    .eq("user_id", userId)
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapDbOrderToOrder(data as Parameters<typeof mapDbOrderToOrder>[0]);
}
