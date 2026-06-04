import {
  computeAcquisitionKm,
  resolvePricingSettingsRow,
  type PricingSettingsRow
} from "lib/pricing";
import { offerChoiceLabel, parseCartLineId } from "lib/cart/cart-line-id";
import type { OfferChoiceKey } from "lib/product-offers";
import Order, { OrderStatus } from "models/Order.model";
import { applyStorefrontProductVisibility } from "lib/storefront-product-visibility";
import { createSupabaseServiceClient } from "utils/supabase";
import { STANDARD_SHIPPING_FEE_KM } from "./constants";
import type { CheckoutDetails, CreateOrderPayload, OrderCartLineInput, ValidatedOrderLine } from "./types";

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
  supplier_product_id?: string | null;
  offer_choice?: string | null;
  offer_label?: string | null;
  supplier_name?: string | null;
  delivery_label?: string | null;
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

function isOfferChoice(value: unknown): value is OfferChoiceKey {
  return value === "cheapest" || value === "fastest";
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

/** Legacy fallback for order_items rows created before offer snapshot migration. */
async function fetchCheapestSupplierNamesByProductIds(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  productIds: string[]
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (!ids.length) return new Map();

  const { data: rows, error } = await supabase
    .from("supplier_products")
    .select(
      "product_id, price_amount, currency, supplier_id, suppliers(id, name, pricing_formula, cost_adjustment_multiplier)"
    )
    .in("product_id", ids)
    .eq("is_active", true);

  if (error || !rows?.length) return new Map();

  type SupplierProductRow = {
    product_id: string;
    price_amount: number | string;
    currency: string | null;
    supplier_id: string;
    suppliers:
      | { id: string; name: string | null; pricing_formula: string | null; cost_adjustment_multiplier: number | null }
      | {
          id: string;
          name: string | null;
          pricing_formula: string | null;
          cost_adjustment_multiplier: number | null;
        }[]
      | null;
  };

  const typedRows = rows as SupplierProductRow[];
  const { data: settingsRows } = await supabase.from("pricing_settings").select("*").limit(1);
  const { settings } = resolvePricingSettingsRow((settingsRows?.[0] ?? null) as PricingSettingsRow | null);

  const bestKmByProduct = new Map<string, { km: number; name: string }>();

  for (const row of typedRows) {
    const supplier =
      row.suppliers == null ? null : Array.isArray(row.suppliers) ? row.suppliers[0] ?? null : row.suppliers;
    const km = computeAcquisitionKm(
      Number(row.price_amount),
      row.currency ?? "",
      {
        id: supplier?.id ?? row.supplier_id,
        pricing_formula: supplier?.pricing_formula ?? null,
        cost_adjustment_multiplier: supplier?.cost_adjustment_multiplier ?? 1
      },
      settings
    );
    if (!Number.isFinite(km) || km <= 0) continue;

    const supplierName = String(supplier?.name ?? "").trim();
    const prev = bestKmByProduct.get(row.product_id);

    if (!prev || km < prev.km) {
      bestKmByProduct.set(row.product_id, { km, name: supplierName });
    }
  }

  return new Map(
    Array.from(bestKmByProduct.entries()).map(([productId, value]) => [productId, value.name])
  );
}

async function fetchSupplierNamesByOfferIds(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  supplierProductIds: string[]
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(supplierProductIds.filter(Boolean)));
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from("supplier_products")
    .select("id, suppliers(name)")
    .in("id", ids);

  if (error || !data?.length) return new Map();

  const map = new Map<string, string>();
  for (const row of data) {
    const raw = row as {
      id: string;
      suppliers: { name: string | null } | { name: string | null }[] | null;
    };
    const s = raw.suppliers;
    const supplier = s == null ? null : Array.isArray(s) ? s[0] ?? null : s;
    const name = supplier?.name?.trim();
    if (name) map.set(String(raw.id), name);
  }
  return map;
}

export function mapDbOrderToOrder(order: DbOrder, legacySupplierByProductId?: Map<string, string>): Order {
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
      verified: false,
      name: { firstName: order.customer_name, lastName: "" }
    },
    items: (order.order_items ?? []).map((item) => {
      const productId = item.product_id ?? undefined;
      const offerChoice = isOfferChoice(item.offer_choice) ? item.offer_choice : undefined;
      const offerLabel =
        item.offer_label?.trim() ||
        (offerChoice ? offerChoiceLabel(offerChoice) : undefined);
      const supplierName =
        item.supplier_name?.trim() ||
        (productId != null ? legacySupplierByProductId?.get(productId) ?? "" : "");

      return {
        product_img: item.product_image ?? "/assets/images/placeholder.png",
        product_name: item.product_name,
        product_price: asNumber(item.unit_price),
        product_quantity: item.quantity,
        ...(productId != null ? { product_id: productId } : {}),
        ...(item.supplier_product_id ? { supplier_product_id: item.supplier_product_id } : {}),
        ...(offerChoice ? { offer_choice: offerChoice } : {}),
        ...(offerLabel ? { offer_label: offerLabel, variant: offerLabel } : {}),
        ...(item.delivery_label?.trim() ? { delivery_label: item.delivery_label.trim() } : {}),
        supplier_name: supplierName
      };
    })
  };
}

async function resolveLegacySupplierMap(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  orderRow: DbOrder
): Promise<Map<string, string> | undefined> {
  const items = orderRow.order_items ?? [];
  const productIds = items
    .filter((item) => item.product_id && !item.supplier_name?.trim())
    .map((item) => String(item.product_id));

  if (!productIds.length) return undefined;
  return fetchCheapestSupplierNamesByProductIds(supabase, productIds);
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

function parseOrderLineInput(raw: OrderCartLineInput): ValidatedOrderLine | null {
  const lineKey = typeof raw.lineId === "string" ? raw.lineId.trim() : typeof raw.id === "string" ? raw.id.trim() : "";
  if (!lineKey) return null;

  const parsed = parseCartLineId(lineKey);
  const productId = (typeof raw.productId === "string" ? raw.productId.trim() : "") || parsed.productId;
  const supplierProductId =
    (typeof raw.supplierProductId === "string" ? raw.supplierProductId.trim() : "") ||
    parsed.supplierProductId ||
    null;

  const qtyRaw = Number(raw.qty);
  if (!productId || !Number.isFinite(qtyRaw) || qtyRaw < 1) return null;

  const qty = Math.floor(qtyRaw);
  const unitPriceRaw = raw.unitPrice != null ? Number(raw.unitPrice) : NaN;
  const offerChoice = isOfferChoice(raw.offerChoice) ? raw.offerChoice : null;
  const offerLabel =
    typeof raw.offerLabel === "string" && raw.offerLabel.trim()
      ? raw.offerLabel.trim()
      : offerChoice
        ? offerChoiceLabel(offerChoice)
        : null;

  return {
    lineId: supplierProductId ? `${productId}:${supplierProductId}` : productId,
    productId,
    supplierProductId,
    qty,
    unitPrice: Number.isFinite(unitPriceRaw) && unitPriceRaw > 0 ? unitPriceRaw : NaN,
    offerChoice,
    offerLabel,
    deliveryLabel:
      typeof raw.deliveryLabel === "string" && raw.deliveryLabel.trim() ? raw.deliveryLabel.trim() : null,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : null,
    slug: typeof raw.slug === "string" && raw.slug.trim() ? raw.slug.trim() : null,
    thumbnail: typeof raw.thumbnail === "string" && raw.thumbnail.trim() ? raw.thumbnail.trim() : null
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
    .map((item) => parseOrderLineInput(item))
    .filter((item): item is ValidatedOrderLine => item != null);

  if (!items.length) {
    throw new Error("Cart is empty.");
  }

  return { checkout, items };
}

export async function createOrder(payload: CreateOrderPayload, userId?: string | null) {
  const { checkout, items } = validatePayload(payload);
  const productIds = Array.from(new Set(items.map((item) => item.productId)));
  const supabase = createSupabaseServiceClient();

  const { data: productRows, error: productsError } = await applyStorefrontProductVisibility(
    supabase.from("products").select("id, name, slug, main_image, price").in("id", productIds)
  );

  if (productsError) throw new Error(productsError.message);

  const productsById = new Map((productRows ?? []).map((product) => [product.id, product as DbProduct]));

  if (productsById.size !== productIds.length) {
    throw new Error("Some cart products are no longer available.");
  }

  const supplierIds = items
    .map((item) => item.supplierProductId)
    .filter((id): id is string => Boolean(id));
  const supplierNameByOfferId = await fetchSupplierNamesByOfferIds(supabase, supplierIds);

  const orderItems = items.map((item) => {
    const product = productsById.get(item.productId);
    if (!product) {
      throw new Error("A cart product is no longer available.");
    }

    const unitPrice =
      Number.isFinite(item.unitPrice) && item.unitPrice > 0
        ? item.unitPrice
        : asNumber(product.price);

    if (unitPrice <= 0) {
      throw new Error("A cart product has no valid price.");
    }

    const lineTotal = Math.round(unitPrice * item.qty * 100) / 100;
    const supplierName =
      (item.supplierProductId ? supplierNameByOfferId.get(item.supplierProductId) : "") || "";

    return {
      product_id: product.id,
      product_name: item.title ?? product.name,
      product_slug: item.slug ?? product.slug,
      product_image: item.thumbnail ?? product.main_image,
      quantity: item.qty,
      unit_price: unitPrice,
      line_total: lineTotal,
      supplier_product_id: item.supplierProductId,
      offer_choice: item.offerChoice,
      offer_label: item.offerLabel,
      supplier_name: supplierName || null,
      delivery_label: item.deliveryLabel
    };
  });

  const subtotal = orderItems.reduce((sum, item) => sum + item.line_total, 0);
  const shippingRounded = STANDARD_SHIPPING_FEE_KM;
  const totalPrice = Math.round((subtotal + shippingRounded) * 100) / 100;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      ...(userId ? { user_id: userId } : {}),
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

  return Promise.all(
    orders.map(async (orderRow) => {
      const legacyMap = await resolveLegacySupplierMap(supabase, orderRow);
      return mapDbOrderToOrder(orderRow, legacyMap);
    })
  );
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
  const legacyMap = await resolveLegacySupplierMap(supabase, orderRow);
  return mapDbOrderToOrder(orderRow, legacyMap);
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
  const legacyMap = await resolveLegacySupplierMap(supabase, orderRow);
  return mapDbOrderToOrder(orderRow, legacyMap);
}
