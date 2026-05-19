/**
 * Smoke test for pricing math (no DB). Run: npx tsx scripts/test-pricing-engine.ts
 */
import assert from "node:assert/strict";
import { computeAcquisitionKm } from "../src/lib/pricing/cost-km";
import { computeOriginalPriceKm } from "../src/lib/pricing/original-price";
import { computeFinalSellingKm, resolveSellingMultiplier, round2 } from "../src/lib/pricing/sell-price";
import type { PricingMarginTierRow, PricingSettingsResolved, SupplierPricingRow } from "../src/lib/pricing/types";

const settings: PricingSettingsResolved = {
  kurs_eur: 370,
  eur_km_rate: 1.95,
  alza_tax: 1.08,
  pdv_bih: 1.17,
  default_selling_margin: 1.15,
  min_absolute_profit_km: 3,
  min_margin_percent: 0.1,
  high_cost_threshold_km: 4000,
  high_cost_max_margin_multiplier: 1.06,
  original_price_markup_percent: 10
};

assert.equal(computeOriginalPriceKm(141.6, 10), 156);
assert.equal(computeOriginalPriceKm(221.22, 10), 243);
assert.equal(computeOriginalPriceKm(100, 10), 110);

const iponSupplier: SupplierPricingRow = {
  id: "s1",
  pricing_formula: "ipon_huf",
  cost_adjustment_multiplier: 1
};

const tiers: PricingMarginTierRow[] = [
  { min_cost_km: 0, max_cost_km: 50, margin_multiplier: 1.22, sort_order: 0 },
  { min_cost_km: 50, max_cost_km: null, margin_multiplier: 1.15, sort_order: 1 }
];

const cost2 = 2;
const m2 = resolveSellingMultiplier(cost2, tiers, settings, null, null);
const sell2 = computeFinalSellingKm(cost2, m2, settings);
assert.ok(sell2 >= cost2 + settings.min_absolute_profit_km - 1e-6, `cheap floor: ${sell2}`);

const cost28 = 28;
const m28 = resolveSellingMultiplier(cost28, tiers, settings, null, null);
const raw28 = round2(
  Math.max(
    cost28 * m28,
    cost28 + settings.min_absolute_profit_km,
    cost28 * (1 + settings.min_margin_percent)
  )
);
const sell28 = computeFinalSellingKm(cost28, m28, settings);
assert.ok(sell28 >= raw28 - 1e-6, `28 rounding up: raw≈${raw28} final=${sell28}`);
const u28 = Math.floor(sell28 + 1e-9) % 10;
assert.ok(u28 === 0 || u28 === 5 || u28 === 9, `charm unit digit: ${sell28}`);

const cost30 = 30;
const m30 = resolveSellingMultiplier(cost30, tiers, settings, null, null);
const sell30 = computeFinalSellingKm(cost30, m30, settings);
assert.ok(sell30 >= 36, `30 KM target-ish: ${sell30}`);

const hufIpon = 100000;
const kmIpon = computeAcquisitionKm(hufIpon, "HUF", iponSupplier, settings);
assert.ok(kmIpon > 0, `ipon acquisition: ${kmIpon}`);

const huSupplier: SupplierPricingRow = {
  id: "s2",
  pricing_formula: "hungary_huf_alza_tax",
  cost_adjustment_multiplier: 1
};
const kmHu = computeAcquisitionKm(hufIpon, "HUF", huSupplier, settings);
assert.ok(kmHu > kmIpon, `alza path higher: ${kmHu} > ${kmIpon}`);

const cost5000 = 5000;
const m5000 = resolveSellingMultiplier(cost5000, tiers, settings, null, null);
const mCapped = Math.min(m5000, settings.high_cost_max_margin_multiplier!);
const sell5000 = computeFinalSellingKm(cost5000, mCapped, settings);
assert.ok(sell5000 / cost5000 <= 1.12, `high cost cap keeps effective markup moderate: ${sell5000 / cost5000}`);

console.log("pricing engine tests OK", { sell2, sell28, sell30, kmIpon, kmHu, sell5000 });
