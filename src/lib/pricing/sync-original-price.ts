import type { SupabaseClient } from "@supabase/supabase-js";
import { computeOriginalPriceFromProductRow, resolveOriginalPriceMarkupPercent } from "./original-price";
import { resolvePricingSettingsRow } from "./resolve-settings";
import type { PricingSettingsRow } from "./types";

export async function loadOriginalPriceMarkupPercent(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from("pricing_settings").select("*").limit(1);
  if (error) throw new Error(error.message);
  const row = (data?.[0] ?? null) as PricingSettingsRow | null;
  const { settings } = resolvePricingSettingsRow(row);
  return settings.original_price_markup_percent;
}

/** Recompute and persist products.original_price from price + custom_price. */
export async function syncProductOriginalPrice(
  supabase: SupabaseClient,
  productId: string,
  markupPercent?: number
): Promise<void> {
  const pct = markupPercent ?? (await loadOriginalPriceMarkupPercent(supabase));

  const { data, error } = await supabase
    .from("products")
    .select("price, custom_price")
    .eq("id", productId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return;

  const original_price = computeOriginalPriceFromProductRow(data, pct);
  const { error: upErr } = await supabase.from("products").update({ original_price }).eq("id", productId);
  if (upErr) throw new Error(upErr.message);
}
