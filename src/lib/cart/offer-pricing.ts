import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeAcquisitionKm,
  computeFinalSellingKm,
  computeOriginalPriceKm,
  resolvePricingSettingsRow,
  resolveSellingMultiplier,
  type PricingMarginTierRow,
  type PricingSettingsRow
} from "lib/pricing";
import {
  daysBetween,
  estimateTechZoneDeliveryDate,
  formatDeliveryLabel,
  normalizeDeliveryPolicy,
  toDeliveryDateStorageKey
} from "lib/product-offers/delivery-estimate";
import { resolveInboundLeadDays } from "lib/product-offers/supplier-lead-days";
import type { OfferChoiceKey } from "lib/product-offers/types";
import { getEffectivePrice } from "lib/effective-price";
import { buildCartLineId } from "./cart-line-id";

const OFFER_ROW_SELECT =
  "id, product_id, price_amount, currency, delivery_days, is_active, suppliers(id, pricing_formula, cost_adjustment_multiplier, delivery_policy, inbound_lead_days_default)";

type SupplierProductOfferRow = {
  id: string;
  product_id: string;
  price_amount: number | string | null;
  currency: string | null;
  delivery_days: number | null;
  is_active: boolean | null;
  suppliers:
    | {
        id: string;
        pricing_formula: string | null;
        cost_adjustment_multiplier: number | null;
        delivery_policy: unknown;
        inbound_lead_days_default: number | null;
      }
    | {
        id: string;
        pricing_formula: string | null;
        cost_adjustment_multiplier: number | null;
        delivery_policy: unknown;
        inbound_lead_days_default: number | null;
      }[]
    | null;
};

type ProductMarginRow = {
  selling_margin_override: number | null;
  categoryMargin: number | null;
};

type SharedPricingContext = {
  settings: ReturnType<typeof resolvePricingSettingsRow>["settings"];
  tiers: PricingMarginTierRow[];
  markupPercent: number;
};

function firstSupplier(raw: SupplierProductOfferRow["suppliers"]) {
  if (raw == null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

async function loadSharedPricingContext(supabase: SupabaseClient): Promise<SharedPricingContext> {
  const [{ data: settingsRows }, { data: tierRows }] = await Promise.all([
    supabase.from("pricing_settings").select("*").limit(1),
    supabase
      .from("pricing_margin_tiers")
      .select("id, min_cost_km, max_cost_km, margin_multiplier, sort_order")
      .order("min_cost_km", { ascending: true })
      .order("sort_order", { ascending: true })
  ]);

  const { settings } = resolvePricingSettingsRow((settingsRows?.[0] ?? null) as PricingSettingsRow | null);
  return {
    settings,
    tiers: (tierRows ?? []) as PricingMarginTierRow[],
    markupPercent: settings.original_price_markup_percent
  };
}

async function loadProductMarginsBatch(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<Map<string, ProductMarginRow>> {
  const map = new Map<string, ProductMarginRow>();
  if (productIds.length === 0) return map;

  const { data, error } = await supabase
    .from("products")
    .select("id, selling_margin_override, categories(selling_margin_default)")
    .in("id", productIds);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const r = row as {
      id: string;
      selling_margin_override: number | null;
      categories:
        | { selling_margin_default: number | null }
        | { selling_margin_default: number | null }[]
        | null;
    };
    const rawCat = r.categories;
    const cat = Array.isArray(rawCat) ? rawCat[0] ?? null : rawCat;
    const categoryMargin =
      cat?.selling_margin_default != null &&
      Number.isFinite(cat.selling_margin_default) &&
      cat.selling_margin_default > 0
        ? cat.selling_margin_default
        : null;

    map.set(String(r.id), {
      selling_margin_override: r.selling_margin_override,
      categoryMargin
    });
  }

  return map;
}

function computeSellingFromRow(
  row: SupplierProductOfferRow,
  shared: SharedPricingContext,
  margins: ProductMarginRow | undefined
): {
  sellingPrice: number;
  originalPrice: number;
  deliveryLabel: string;
  estimatedDays: number;
  estimatedDeliveryDate: string;
} | null {
  if (!row.is_active || row.price_amount == null) return null;

  const supplier = firstSupplier(row.suppliers);
  const acquisitionKm = computeAcquisitionKm(
    Number(row.price_amount),
    row.currency ?? "",
    {
      id: supplier?.id ?? "",
      pricing_formula: supplier?.pricing_formula ?? null,
      cost_adjustment_multiplier: supplier?.cost_adjustment_multiplier ?? 1
    },
    shared.settings
  );
  if (!Number.isFinite(acquisitionKm) || acquisitionKm <= 0) return null;

  const sellingPrice = computeFinalSellingKm(
    acquisitionKm,
    resolveSellingMultiplier(
      acquisitionKm,
      shared.tiers,
      shared.settings,
      margins?.categoryMargin ?? null,
      margins?.selling_margin_override ?? null
    ),
    shared.settings
  );

  const policy = normalizeDeliveryPolicy(supplier?.delivery_policy);
  const rowDeliveryDays =
    row.delivery_days != null && Number.isFinite(Number(row.delivery_days))
      ? Number(row.delivery_days)
      : null;
  const inboundLeadDays = resolveInboundLeadDays(
    supplier?.id,
    rowDeliveryDays,
    supplier?.inbound_lead_days_default
  );
  const today = new Date();
  const estimatedDate = estimateTechZoneDeliveryDate(policy, inboundLeadDays, today);
  const estimatedDaysFromToday = daysBetween(today, estimatedDate);

  return {
    sellingPrice,
    originalPrice: computeOriginalPriceKm(sellingPrice, shared.markupPercent),
    deliveryLabel: formatDeliveryLabel(estimatedDate, estimatedDaysFromToday),
    estimatedDays: estimatedDaysFromToday,
    estimatedDeliveryDate: toDeliveryDateStorageKey(estimatedDate)
  };
}

function cartDeliveryLabelFromMeta(deliveryLabel: string): string {
  return `Rok isporuke: ${deliveryLabel.replace(/^Procijenjena isporuka: /, "")}`;
}

/** Osvježi cijene (i labele ponude); rok isporuke ostaje iz PDP / hydrate, ne prepisuj. */
export async function enrichCartItemsDelivery(
  supabase: SupabaseClient,
  items: import("contexts/CartContext").CartItem[]
): Promise<import("contexts/CartContext").CartItem[]> {
  if (!items.length) return items;

  const lines = items.map((item) => ({
    lineId: item.id,
    productId: item.productId,
    supplierProductId: item.supplierProductId
  }));

  const { prices, metaByLineId } = await resolveCartOfferPrices(supabase, lines, {
    resolveOfferChoice: true
  });
  const priceById = new Map(prices.map((p) => [p.id, p]));

  return items.map((item) => {
    const meta = metaByLineId.get(item.id);
    const priceRow = priceById.get(item.id);
    const hasDeliverySnapshot = Boolean(item.estimatedDeliveryDate?.trim());

    return {
      ...item,
      ...(meta ? { offerChoice: meta.offerChoice } : {}),
      ...(!hasDeliverySnapshot && meta
        ? {
            deliveryLabel: cartDeliveryLabelFromMeta(meta.deliveryLabel),
            estimatedDeliveryDate: meta.estimatedDeliveryDate
          }
        : {}),
      ...(priceRow
        ? {
            price: priceRow.price,
            ...(priceRow.originalPrice != null && priceRow.originalPrice > 0
              ? { originalPrice: priceRow.originalPrice }
              : {})
          }
        : {})
    };
  });
}

/** Cheapest/fastest ids per product — only when cart lines need offerChoice labels. */
async function resolveCheapestFastestByProduct(
  supabase: SupabaseClient,
  productIds: string[],
  shared: SharedPricingContext,
  marginsByProduct: Map<string, ProductMarginRow>
): Promise<{ cheapest: Map<string, string>; fastest: Map<string, string> }> {
  const cheapest = new Map<string, string>();
  const fastest = new Map<string, string>();

  if (productIds.length === 0) return { cheapest, fastest };

  const { data: productOffers, error } = await supabase
    .from("supplier_products")
    .select(OFFER_ROW_SELECT)
    .in("product_id", productIds)
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  const byProduct = new Map<string, { id: string; sellingPrice: number; estimatedDays: number }[]>();

  for (const row of (productOffers ?? []) as SupplierProductOfferRow[]) {
    const productId = String(row.product_id);
    const computed = computeSellingFromRow(row, shared, marginsByProduct.get(productId));
    if (!computed) continue;
    const list = byProduct.get(productId) ?? [];
    list.push({
      id: row.id,
      sellingPrice: computed.sellingPrice,
      estimatedDays: computed.estimatedDays
    });
    byProduct.set(productId, list);
  }

  for (const [productId, priced] of Array.from(byProduct.entries())) {
    if (!priced.length) continue;
    type PricedRow = { id: string; sellingPrice: number; estimatedDays: number };
    const cheapestRow = priced.reduce((a: PricedRow, b: PricedRow) =>
      b.sellingPrice < a.sellingPrice ? b : a
    );
    const fastestRow = priced.reduce((a: PricedRow, b: PricedRow) => {
      if (b.estimatedDays < a.estimatedDays) return b;
      if (b.estimatedDays === a.estimatedDays && b.sellingPrice < a.sellingPrice) return b;
      return a;
    });
    cheapest.set(productId, cheapestRow.id);
    fastest.set(productId, fastestRow.id);
  }

  return { cheapest, fastest };
}

export async function resolveCartOfferPrices(
  supabase: SupabaseClient,
  lines: { lineId: string; productId: string; supplierProductId: string }[],
  options?: { resolveOfferChoice?: boolean }
): Promise<{
  prices: { id: string; price: number; originalPrice?: number }[];
  unavailableIds: string[];
  metaByLineId: Map<string, {
    deliveryLabel: string;
    offerChoice: OfferChoiceKey;
    estimatedDeliveryDate: string;
  }>;
}> {
  const uniqueSupplierIds = Array.from(new Set(lines.map((l) => l.supplierProductId)));
  if (uniqueSupplierIds.length === 0) {
    return { prices: [], unavailableIds: [], metaByLineId: new Map() };
  }

  const productIds = Array.from(new Set(lines.map((l) => l.productId)));
  const resolveOfferChoice = options?.resolveOfferChoice ?? false;

  const [shared, marginsByProduct, { data: offerRows, error }] = await Promise.all([
    loadSharedPricingContext(supabase),
    loadProductMarginsBatch(supabase, productIds),
    supabase.from("supplier_products").select(OFFER_ROW_SELECT).in("id", uniqueSupplierIds)
  ]);

  if (error) throw new Error(error.message);

  const rowById = new Map<string, SupplierProductOfferRow>();
  for (const row of (offerRows ?? []) as SupplierProductOfferRow[]) {
    rowById.set(String(row.id), row);
  }

  let cheapestByProduct = new Map<string, string>();
  let fastestByProduct = new Map<string, string>();

  if (resolveOfferChoice) {
    const resolved = await resolveCheapestFastestByProduct(
      supabase,
      productIds,
      shared,
      marginsByProduct
    );
    cheapestByProduct = resolved.cheapest;
    fastestByProduct = resolved.fastest;
  }

  const prices: { id: string; price: number; originalPrice?: number }[] = [];
  const unavailableIds: string[] = [];
  const metaByLineId = new Map<
    string,
    { deliveryLabel: string; offerChoice: OfferChoiceKey; estimatedDeliveryDate: string }
  >();
  for (const line of lines) {
    const row = rowById.get(line.supplierProductId);
    if (!row || String(row.product_id) !== line.productId) {
      unavailableIds.push(line.lineId);
      continue;
    }

    const computed = computeSellingFromRow(row, shared, marginsByProduct.get(line.productId));
    if (!computed) {
      unavailableIds.push(line.lineId);
      continue;
    }

    const cheapestId = cheapestByProduct.get(line.productId);
    const fastestId = fastestByProduct.get(line.productId);
    const offerChoice: OfferChoiceKey =
      resolveOfferChoice &&
      fastestId &&
      line.supplierProductId === fastestId &&
      line.supplierProductId !== cheapestId
        ? "fastest"
        : "cheapest";

    prices.push({
      id: line.lineId,
      price: computed.sellingPrice,
      originalPrice: computed.originalPrice
    });
    metaByLineId.set(line.lineId, {
      deliveryLabel: computed.deliveryLabel,
      offerChoice,
      estimatedDeliveryDate: computed.estimatedDeliveryDate
    });
  }

  return { prices, unavailableIds, metaByLineId };
}

export async function hydrateCartItemsFromOffers(
  supabase: SupabaseClient,
  rows: {
    product: {
      id: string;
      name: string | null;
      slug: string | null;
      main_image: string | null;
      price?: unknown;
      custom_price?: unknown;
    };
    supplierProductId: string;
    qty: number;
  }[]
): Promise<import("contexts/CartContext").CartItem[]> {
  if (!rows.length) return [];

  const lines = rows.map((r) => ({
    lineId: buildCartLineId(r.product.id, r.supplierProductId),
    productId: r.product.id,
    supplierProductId: r.supplierProductId
  }));

  const { prices, metaByLineId } = await resolveCartOfferPrices(supabase, lines, {
    resolveOfferChoice: true
  });

  const priceByLineId = new Map(prices.map((p) => [p.id, p]));
  const items: import("contexts/CartContext").CartItem[] = [];

  for (const row of rows) {
    const lineId = buildCartLineId(row.product.id, row.supplierProductId);

    const priceRow = priceByLineId.get(lineId);
    const meta = metaByLineId.get(lineId);

    if (priceRow && meta) {
      items.push({
        id: lineId,
        productId: row.product.id,
        supplierProductId: row.supplierProductId,
        offerChoice: meta.offerChoice,
        deliveryLabel: cartDeliveryLabelFromMeta(meta.deliveryLabel),
        estimatedDeliveryDate: meta.estimatedDeliveryDate,
        originalPrice: priceRow.originalPrice,
        slug: row.product.slug?.trim() || row.product.id,
        title: row.product.name?.trim() || "Product",
        thumbnail: row.product.main_image ?? "/assets/images/placeholder.png",
        price: priceRow.price,
        qty: Math.max(1, Math.floor(row.qty))
      });
      continue;
    }

    const fallbackPrice = getEffectivePrice(row.product.custom_price, row.product.price);
    if (fallbackPrice <= 0) continue;

    items.push({
      id: lineId,
      productId: row.product.id,
      supplierProductId: row.supplierProductId,
      offerChoice: "cheapest",
      slug: row.product.slug?.trim() || row.product.id,
      title: row.product.name?.trim() || "Product",
      thumbnail: row.product.main_image ?? "/assets/images/placeholder.png",
      price: fallbackPrice,
      qty: Math.max(1, Math.floor(row.qty))
    });
  }

  return items;
}

/** @deprecated Prefer hydrateCartItemsFromOffers for multiple lines. */
export async function hydrateCartItemFromOffer(
  supabase: SupabaseClient,
  params: {
    product: {
      id: string;
      name: string | null;
      slug: string | null;
      main_image: string | null;
    };
    supplierProductId: string;
    qty: number;
  }
): Promise<import("contexts/CartContext").CartItem | null> {
  const items = await hydrateCartItemsFromOffers(supabase, [params]);
  return items[0] ?? null;
}
