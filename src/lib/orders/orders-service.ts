import { convertToDisplayCurrency } from "lib/pricing/convert";
import Order, { OrderStatus } from "models/Order.model";
import { createSupabaseServiceClient } from "utils/supabase";
import { STANDARD_SHIPPING_FEE_KM } from "./constants";
import type { CheckoutDetails, CreateOrderPayload, OrderCartItem } from "./types";

const ORDER_STATUSES: OrderStatus[] = ["Pending", "Processing", "Delivered", "Cancelled"];

type DbOrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
};

type DbOrder = {
  id: string;
  status: OrderStatus;
  payment_method: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_company: string | null;
  shipping_city: string;
  shipping_country: string;
  shipping_zip: string;
  shipping_address1: string;
  shipping_address2: string | null;
  delivery_notes: string | null;
  subtotal: number | string;
  shipping_total: number | string;
  tax_total: number | string;
  discount_total: number | string;
  total_price: number | string;
  created_at: string;
  updated_at: string;
  order_items?: DbOrderItem[];
};

type DbProduct = {
  id: string;
  name: string;
  slug: string;
  main_image: string | null;
  price: number | string | null;
};

function asNumber(value: number | string | null | undefined) {
  return value == null ? 0 : Number(value);
}

function formatShippingAddress(order: DbOrder) {
  return [
    order.shipping_address1,
    order.shipping_city ?? undefined,
    order.shipping_zip,
    order.shipping_country
  ]
    .map((segment) => (typeof segment === "string" ? segment.trim() : segment))
    .filter(Boolean)
    .join(", ");
}

/**
 * Suppliers behind the lowest converted KM price per product (same rules as storefront aggregation).
 */
async function fetchCheapestSupplierNamesByProductIds(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  productIds: string[]
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (!ids.length) return new Map();

  const { data: rows, error } = await supabase
    .from("supplier_products")
    .select("product_id, price_amount, currency, supplier_id")
    .in("product_id", ids);

  if (error || !rows?.length) return new Map();

  type SupplierProductRow = {
    product_id: string;
    price_amount: number | string;
    currency: string | null;
    supplier_id: string;
  };

  const typedRows = rows as SupplierProductRow[];
  const supplierIds = Array.from(new Set(typedRows.map((row) => row.supplier_id).filter(Boolean)));

  const { data: supplierRows } =
    supplierIds.length > 0
      ? await supabase.from("suppliers").select("id, name").in("id", supplierIds)
      : { data: [] };

  const nameBySupplierId = new Map<string, string>(
    ((supplierRows ?? []) as { id: string; name: string | null }[]).map((s) => [
      s.id,
      String(s.name ?? "").trim()
    ])
  );

  const bestKmByProduct = new Map<string, { km: number; name: string }>();

  for (const row of typedRows) {
    const km = convertToDisplayCurrency(Number(row.price_amount), row.currency ?? "", row.supplier_id);
    if (!Number.isFinite(km) || km <= 0) continue;

    const supplierName = nameBySupplierId.get(row.supplier_id) ?? "";
    const prev = bestKmByProduct.get(row.product_id);

    if (!prev || km < prev.km) {
      bestKmByProduct.set(row.product_id, { km, name: supplierName });
    }
  }

  return new Map(
    Array.from(bestKmByProduct.entries()).map(([productId, value]) => [productId, value.name])
  );
}

export function mapDbOrderToOrder(order: DbOrder, supplierByProductId?: Map<string, string>): Order {
  return {
    id: order.id,
    status: order.status,
    tax: asNumber(order.tax_total),
    discount: asNumber(order.discount_total),
    deliveredAt: order.updated_at,
    createdAt: order.created_at,
    isDelivered: order.status === "Delivered",
    subtotal: asNumber(order.subtotal),
    shippingTotal: asNumber(order.shipping_total),
    totalPrice: asNumber(order.total_price),
    shippingAddress: formatShippingAddress(order),
    deliveryNotes: order.delivery_notes ?? "",
    paymentMethod: order.payment_method,
    user: {
      id: order.customer_email,
      email: order.customer_email,
      phone: order.customer_phone,
      avatar: "",
      password: "",
      dateOfBirth: "",
      verified: false,
      name: { firstName: order.customer_name, lastName: "" }
    },
    items: (order.order_items ?? []).map((item) => {
      const productId = item.product_id ?? undefined;
      const supplierName =
        productId != null ? supplierByProductId?.get(productId) ?? "" : "";

      return {
        product_img: item.product_image ?? "/assets/images/placeholder.png",
        product_name: item.product_name,
        product_price: asNumber(item.unit_price),
        product_quantity: item.quantity,
        ...(productId != null ? { product_id: productId } : {}),
        supplier_name: supplierName
      };
    })
  };
}

function normalizeCheckout(checkout: CheckoutDetails) {
  return {
    ...checkout,
    shipping_name: checkout.shipping_name?.trim(),
    shipping_email: checkout.shipping_email?.trim(),
    shipping_contact: checkout.shipping_contact?.trim(),
    shipping_city: checkout.shipping_city?.trim(),
    shipping_zip: checkout.shipping_zip?.trim(),
    shipping_address1: checkout.shipping_address1?.trim(),
    shipping_address2: checkout.shipping_address2?.trim(),
    shipping_company: checkout.shipping_company?.trim(),
    delivery_notes: checkout.delivery_notes?.trim()
  };
}

function validatePayload(payload: CreateOrderPayload) {
  if (!payload.checkout || !Array.isArray(payload.items)) {
    throw new Error("Invalid order payload.");
  }

  const checkout = normalizeCheckout(payload.checkout);
  const requiredFields = [
    checkout.shipping_name,
    checkout.shipping_email,
    checkout.shipping_contact,
    checkout.shipping_city,
    checkout.shipping_zip,
    checkout.shipping_address1,
    checkout.shipping_country?.label
  ];

  if (requiredFields.some((value) => !value)) {
    throw new Error("Missing required checkout fields.");
  }

  const items = payload.items
    .map((item) => ({ id: item.id, qty: Number(item.qty) }))
    .filter((item): item is OrderCartItem => Boolean(item.id) && Number.isInteger(item.qty) && item.qty > 0);

  if (!items.length) {
    throw new Error("Cart is empty.");
  }

  return { checkout, items };
}

export async function createOrder(payload: CreateOrderPayload) {
  const { checkout, items } = validatePayload(payload);
  const productIds = Array.from(new Set(items.map((item) => item.id)));
  const supabase = createSupabaseServiceClient();

  const { data: productRows, error: productsError } = await supabase
    .from("products")
    .select("id, name, slug, main_image, price")
    .in("id", productIds)
    .eq("is_active", true);

  if (productsError) throw new Error(productsError.message);

  const productsById = new Map((productRows ?? []).map((product) => [product.id, product as DbProduct]));

  if (productsById.size !== productIds.length) {
    throw new Error("Some cart products are no longer available.");
  }

  const orderItems = items.map((item) => {
    const product = productsById.get(item.id);
    const unitPrice = asNumber(product?.price);

    if (!product || unitPrice <= 0) {
      throw new Error("A cart product has no valid price.");
    }

    return {
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      product_image: product.main_image,
      quantity: item.qty,
      unit_price: unitPrice,
      line_total: unitPrice * item.qty
    };
  });

  const subtotal = orderItems.reduce((sum, item) => sum + item.line_total, 0);
  const shippingRounded = STANDARD_SHIPPING_FEE_KM;
  const totalPrice = Math.round((subtotal + shippingRounded) * 100) / 100;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      status: "Pending",
      payment_method: "Cash on Delivery",
      customer_name: checkout.shipping_name,
      customer_email: checkout.shipping_email,
      customer_phone: checkout.shipping_contact,
      shipping_company: checkout.shipping_company || null,
      shipping_city: checkout.shipping_city,
      shipping_country: checkout.shipping_country.label,
      shipping_zip: checkout.shipping_zip,
      shipping_address1: checkout.shipping_address1,
      shipping_address2: checkout.shipping_address2 || null,
      billing_name: checkout.same_as_shipping ? checkout.shipping_name : checkout.billing_name || null,
      billing_email: checkout.same_as_shipping ? checkout.shipping_email : checkout.billing_email || null,
      billing_phone: checkout.same_as_shipping ? checkout.shipping_contact : checkout.billing_contact || null,
      billing_country: checkout.same_as_shipping
        ? checkout.shipping_country.label
        : checkout.billing_country?.label || null,
      billing_zip: checkout.same_as_shipping ? checkout.shipping_zip : checkout.billing_zip || null,
      billing_address1: checkout.same_as_shipping
        ? checkout.shipping_address1
        : checkout.billing_address1 || null,
      billing_address2: checkout.same_as_shipping
        ? checkout.shipping_address2 || null
        : checkout.billing_address2 || null,
      delivery_notes: checkout.delivery_notes || null,
      subtotal: subtotal,
      shipping_total: shippingRounded,
      tax_total: 0,
      discount_total: 0,
      total_price: totalPrice
    })
    .select("id")
    .single();

  if (orderError) throw new Error(orderError.message);

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    throw new Error(itemsError.message);
  }

  return { orderId: order.id };
}

export async function getOrders() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const orders = (data ?? []) as DbOrder[];
  const productIds = orders.flatMap((orderRow) =>
    (orderRow.order_items ?? []).map((item) => item.product_id).filter(Boolean)
  ) as string[];

  const supplierByProductId = await fetchCheapestSupplierNamesByProductIds(supabase, productIds);

  return orders.map((orderRow) => mapDbOrderToOrder(orderRow, supplierByProductId));
}

export async function getOrder(id: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const orderRow = data as DbOrder;
  const productIds = (orderRow.order_items ?? []).map((item) => item.product_id).filter(Boolean) as string[];
  const supplierByProductId = await fetchCheapestSupplierNamesByProductIds(supabase, productIds);

  return mapDbOrderToOrder(orderRow, supplierByProductId);
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  if (!ORDER_STATUSES.includes(status)) {
    throw new Error("Invalid order status.");
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, order_items(*)")
    .single();

  if (error) throw new Error(error.message);

  const orderRow = data as DbOrder;
  const productIds = (orderRow.order_items ?? []).map((item) => item.product_id).filter(Boolean) as string[];
  const supplierByProductId = await fetchCheapestSupplierNamesByProductIds(supabase, productIds);

  return mapDbOrderToOrder(orderRow, supplierByProductId);
}
