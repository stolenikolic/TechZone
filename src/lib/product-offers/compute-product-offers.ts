import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeAcquisitionKm,
  computeFinalSellingKm,
  computeOriginalPriceKm,
  resolvePricingSettingsRow,
  resolveSellingMultiplier,
  type PricingMarginTierRow,
  type PricingSettingsRow,
  type SupplierPricingRow
} from "lib/pricing";
import {
  daysBetween,
  estimateTechZoneDeliveryDate,
  formatDeliveryLabel,
  toDeliveryDateStorageKey,
  normalizeDeliveryPolicy
} from "./delivery-estimate";
import { formatRokIsporuke } from "./fallback-offers";
import { resolveInboundLeadDays } from "./supplier-lead-days";
import type { ProductOffersSummary, StorefrontProductOffer } from "./types";

const OFFERS_SELECT_FULL =
  "id, price_amount, currency, delivery_days, warranty_months, suppliers(id, pricing_formula, cost_adjustment_multiplier, delivery_policy, inbound_lead_days_default)";
const OFFERS_SELECT_LEGACY =
  "id, price_amount, currency, suppliers(id, pricing_formula, cost_adjustment_multiplier)";

type SupplierProductRow = {
  id: string;
  price_amount: number | string | null;
  currency: string | null;
  delivery_days: number | null;
  warranty_months: number | null;
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
  categories:
    | { selling_margin_default: number | null }
    | { selling_margin_default: number | null }[]
    | null;
};

function firstSupplier(raw: SupplierProductRow["suppliers"]): {
  id: string;
  pricing_formula: string | null;
  cost_adjustment_multiplier: number | null;
  delivery_policy: unknown;
  inbound_lead_days_default: number | null;
} | null {
  if (raw == null) return null;
  const s = Array.isArray(raw) ? raw[0] ?? null : raw;
  return s ?? null;
}

function categoryDefaultFromProduct(row: ProductMarginRow): number | null {
  const raw = row.categories;
  if (raw == null) return null;
  const c = Array.isArray(raw) ? raw[0] ?? null : raw;
  const v = c?.selling_margin_default;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function formatWarrantyMonths(months: number | null): string | null {
  if (months == null || !Number.isFinite(months) || months <= 0) return null;
  const m = Math.round(months);
  if (m === 1) return "Garancija: 1 mjesec";
  if (m >= 2 && m <= 4) return `Garancija: ${m} mjeseca`;
  return `Garancija: ${m} mjeseci`;
}

export async function computeProductOffersForStorefront(
  supabase: SupabaseClient,
  productId: string
): Promise<ProductOffersSummary | null> {
  const [{ data: settingsRows, error: settingsError }, { data: tierRows, error: tiersError }, { data: productRow, error: productError }] =
    await Promise.all([
      supabase.from("pricing_settings").select("*").limit(1),
      supabase
        .from("pricing_margin_tiers")
        .select("id, min_cost_km, max_cost_km, margin_multiplier, sort_order")
        .order("min_cost_km", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("products")
        .select("selling_margin_override, categories(selling_margin_default)")
        .eq("id", productId)
        .maybeSingle()
    ]);

  if (settingsError || tiersError || productError || !productRow) {
    return null;
  }

  const { settings } = resolvePricingSettingsRow((settingsRows?.[0] ?? null) as PricingSettingsRow | null);
  const originalMarkupPercent = settings.original_price_markup_percent;
  const tiers = (tierRows ?? []) as PricingMarginTierRow[];
  const pm = productRow as ProductMarginRow;
  const categoryMargin =
    (Array.isArray(pm.categories)
      ? pm.categories[0]?.selling_margin_default
      : pm.categories?.selling_margin_default) ?? null;

  let rows: SupplierProductRow[] | null = null;
  let offersQueryError: string | null = null;

  const fullResult = await supabase
    .from("supplier_products")
    .select(OFFERS_SELECT_FULL)
    .eq("product_id", productId)
    .eq("is_active", true);

  if (fullResult.error) {
    offersQueryError = fullResult.error.message;
    const legacyResult = await supabase
      .from("supplier_products")
      .select(OFFERS_SELECT_LEGACY)
      .eq("product_id", productId)
      .eq("is_active", true);
    if (!legacyResult.error) {
      rows = (legacyResult.data ?? []) as SupplierProductRow[];
      offersQueryError = null;
    }
  } else {
    rows = (fullResult.data ?? []) as SupplierProductRow[];
  }

  if (offersQueryError) {
    console.warn("[product-offers]", offersQueryError);
  }

  if (!rows?.length) {
    return {
      offers: [],
      cheapestOfferId: null,
      fastestOfferId: null,
      deliveryTrustLabel: null,
      warrantyTrustLabel: null
    };
  }

  const today = new Date();
  const offers: StorefrontProductOffer[] = [];

  for (const row of rows as SupplierProductRow[]) {
    if (row.price_amount == null) continue;
    const supplier = firstSupplier(row.suppliers);
    const acquisitionKm = computeAcquisitionKm(
      Number(row.price_amount),
      row.currency ?? "",
      {
        id: supplier?.id ?? "",
        pricing_formula: supplier?.pricing_formula ?? null,
        cost_adjustment_multiplier: supplier?.cost_adjustment_multiplier ?? 1
      },
      settings
    );
    if (!Number.isFinite(acquisitionKm) || acquisitionKm <= 0) continue;

    const sellingPrice = computeFinalSellingKm(
      acquisitionKm,
      resolveSellingMultiplier(
        acquisitionKm,
        tiers,
        settings,
        categoryMargin,
        pm.selling_margin_override
      ),
      settings
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
    const estimatedDate = estimateTechZoneDeliveryDate(policy, inboundLeadDays, today);
    const estimatedDaysFromToday = daysBetween(today, estimatedDate);

    offers.push({
      id: row.id,
      sellingPrice,
      originalPrice: computeOriginalPriceKm(sellingPrice, originalMarkupPercent),
      deliveryDays: inboundLeadDays,
      warrantyMonths:
        row.warranty_months != null && Number.isFinite(Number(row.warranty_months))
          ? Math.round(Number(row.warranty_months))
          : null,
      estimatedDeliveryDate: toDeliveryDateStorageKey(estimatedDate),
      estimatedDaysFromToday,
      deliveryLabel: formatDeliveryLabel(estimatedDate, estimatedDaysFromToday)
    });
  }

  if (!offers.length) {
    return {
      offers: [],
      cheapestOfferId: null,
      fastestOfferId: null,
      deliveryTrustLabel: null,
      warrantyTrustLabel: null
    };
  }

  let cheapestOfferId = offers[0].id;
  let fastestOfferId = offers[0].id;
  let minPrice = offers[0].sellingPrice;
  let minDays = offers[0].estimatedDaysFromToday;

  for (const o of offers) {
    if (o.sellingPrice < minPrice) {
      minPrice = o.sellingPrice;
      cheapestOfferId = o.id;
    }
    if (o.estimatedDaysFromToday < minDays) {
      minDays = o.estimatedDaysFromToday;
      fastestOfferId = o.id;
    } else if (o.estimatedDaysFromToday === minDays && o.sellingPrice < offers.find((x) => x.id === fastestOfferId)!.sellingPrice) {
      fastestOfferId = o.id;
    }
  }

  const fastest = offers.find((o) => o.id === fastestOfferId)!;
  const warrantyCandidates = offers.map((o) => o.warrantyMonths).filter((m): m is number => m != null && m > 0);
  const maxWarranty = warrantyCandidates.length ? Math.max(...warrantyCandidates) : null;

  return {
    offers,
    cheapestOfferId,
    fastestOfferId,
    deliveryTrustLabel: formatRokIsporuke(fastest),
    warrantyTrustLabel: formatWarrantyMonths(maxWarranty)
  };
}
