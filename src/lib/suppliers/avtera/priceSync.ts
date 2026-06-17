/**
 * Avtera price sync — XML feed cijene, zaliha, globalna deaktivacija, aggregatePrices.
 * Run: npx tsx scripts/run-avtera-price-sync.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregatePrices, reconcileProductsIsActiveFromSupplierOffers } from "lib/pricing";
import { createSupabaseServiceClient } from "utils/supabase";
import { AVTERA_SUPPLIER_ID } from "./constants";
import { withPostgrestTransientRetry } from "./transient-retry";
import {
  assertAvteraFeedGuard,
  countAvteraIzdelekInFeed,
  parseAvteraXmlFeedPriceOnly
} from "./xmlFeed";

const LOG = "[Avtera price sync]";

const POSTGREST_MAX_ROWS = 1000;
const DEACTIVATE_CHUNK = 100;

type DbOfferRow = {
  supplier_product_id: string;
  price_amount: number | null;
  delivery_days: number | null;
  is_active: boolean;
};

function feedOptions() {
  const fixture = process.env.AVTERA_XML_FIXTURE?.trim();
  const feedUrl = process.env.AVTERA_XML_FEED_URL?.trim();
  if (!fixture && !feedUrl) {
    throw new Error("Postavi AVTERA_XML_FEED_URL ili AVTERA_XML_FIXTURE u .env.local");
  }
  return { fixturePath: fixture || undefined, feedUrl: fixture ? undefined : feedUrl };
}

async function fetchAllAvteraOffers(supabase: SupabaseClient): Promise<DbOfferRow[]> {
  const rows: DbOfferRow[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("avteraPrice.fetchOffers", async () =>
      supabase
        .from("supplier_products")
        .select("supplier_product_id, price_amount, delivery_days, is_active")
        .eq("supplier_id", AVTERA_SUPPLIER_ID)
        .order("supplier_product_id", { ascending: true })
        .range(offset, offset + POSTGREST_MAX_ROWS - 1)
    );
    if (error) throw new Error(`Avtera price sync fetch offers: ${error.message}`);
    const page = (data ?? []) as DbOfferRow[];
    if (page.length === 0) break;
    rows.push(...page);
    offset += page.length;
    if (page.length < POSTGREST_MAX_ROWS) break;
  }

  return rows;
}

async function deactivateInactiveAvteraGlobally(
  supabase: SupabaseClient,
  fetchedIds: Set<string>
): Promise<number> {
  const staleIds: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("avteraPrice.activeOffers", async () =>
      supabase
        .from("supplier_products")
        .select("supplier_product_id")
        .eq("supplier_id", AVTERA_SUPPLIER_ID)
        .eq("is_active", true)
        .order("supplier_product_id", { ascending: true })
        .range(offset, offset + POSTGREST_MAX_ROWS - 1)
    );
    if (error) throw new Error(`Avtera price sync deactivate scan: ${error.message}`);
    const page = (data ?? []) as Array<{ supplier_product_id: string }>;
    if (page.length === 0) break;
    for (const row of page) {
      const id = String(row.supplier_product_id);
      if (!fetchedIds.has(id)) staleIds.push(id);
    }
    offset += page.length;
    if (page.length < POSTGREST_MAX_ROWS) break;
  }

  if (staleIds.length === 0) return 0;

  const updatedAt = new Date().toISOString();
  let deactivated = 0;
  for (let i = 0; i < staleIds.length; i += DEACTIVATE_CHUNK) {
    const chunk = staleIds.slice(i, i + DEACTIVATE_CHUNK);
    const { error: uErr } = await withPostgrestTransientRetry("avteraPrice.deactivate", async () =>
      supabase
        .from("supplier_products")
        .update({ is_active: false, updated_at: updatedAt })
        .eq("supplier_id", AVTERA_SUPPLIER_ID)
        .in("supplier_product_id", chunk)
    );
    if (uErr) throw new Error(`Avtera price sync deactivate: ${uErr.message}`);
    deactivated += chunk.length;
  }

  if (deactivated > 0) {
    console.log(`${LOG} Deaktivirano ${deactivated} ponuda (nema u feedu).`);
  }
  return deactivated;
}

export type AvteraPriceSyncResult = {
  success: boolean;
  error?: string;
  summary?: {
    feed_items: number;
    feed_valid: number;
    db_offers: number;
    updated: number;
    deactivated: number;
    reactivated: number;
    unchanged: number;
    prices_aggregated: number;
    aggregate_error?: string;
  };
};

export async function runAvteraPriceSync(): Promise<AvteraPriceSyncResult> {
  const supabase = createSupabaseServiceClient();

  try {
    console.log(`${LOG} Pokretanje…`);
    const opts = feedOptions();

    const feedCount = await countAvteraIzdelekInFeed(opts);
    assertAvteraFeedGuard(feedCount);

    const feedMap = await parseAvteraXmlFeedPriceOnly(opts);
    const fetchedIds = new Set(feedMap.keys());
    console.log(
      `${LOG} Feed: ${feedCount} izdelek elemenata, ${feedMap.size} validnih (cijena + izdelekID)`
    );

    const dbOffers = await fetchAllAvteraOffers(supabase);
    console.log(`${LOG} Ponuda u DB: ${dbOffers.length}`);

    const updatedAt = new Date().toISOString();
    let updated = 0;
    let unchanged = 0;
    let reactivated = 0;
    let deactivatedInLoop = 0;

    for (const row of dbOffers) {
      const id = String(row.supplier_product_id);
      const feed = feedMap.get(id);

      if (!feed) {
        if (row.is_active) {
          const { error } = await withPostgrestTransientRetry("avteraPrice.deactRow", async () =>
            supabase
              .from("supplier_products")
              .update({ is_active: false, updated_at: updatedAt })
              .eq("supplier_id", AVTERA_SUPPLIER_ID)
              .eq("supplier_product_id", id)
          );
          if (error) throw new Error(`Avtera deactivate ${id}: ${error.message}`);
          updated += 1;
          deactivatedInLoop += 1;
          console.log(`${LOG} Deaktivirano ${id} (nema u feedu)`);
        } else {
          unchanged += 1;
        }
        continue;
      }

      const prevPrice = row.price_amount != null ? Number(row.price_amount) : NaN;
      const prevDelivery = row.delivery_days != null ? Number(row.delivery_days) : null;
      const priceChanged = !Number.isFinite(prevPrice) || prevPrice !== feed.price;
      const deliveryChanged = prevDelivery !== feed.deliveryDays;
      const activeChanged = row.is_active !== feed.isActive;
      const wasReactivated = row.is_active === false && feed.isActive;

      if (!priceChanged && !deliveryChanged && !activeChanged && !wasReactivated) {
        unchanged += 1;
        continue;
      }

      const { error } = await withPostgrestTransientRetry("avteraPrice.update", async () =>
        supabase
          .from("supplier_products")
          .update({
            price_amount: feed.price,
            currency: "KM",
            delivery_days: feed.deliveryDays,
            is_active: feed.isActive,
            updated_at: updatedAt
          })
          .eq("supplier_id", AVTERA_SUPPLIER_ID)
          .eq("supplier_product_id", id)
      );
      if (error) throw new Error(`Avtera update ${id}: ${error.message}`);
      updated += 1;
      if (wasReactivated) reactivated += 1;

      const changes: string[] = [];
      if (priceChanged) changes.push(`price ${prevPrice}→${feed.price}`);
      if (deliveryChanged) changes.push(`delivery ${prevDelivery}→${feed.deliveryDays}`);
      if (activeChanged) changes.push(`active ${row.is_active}→${feed.isActive}`);
      console.log(`${LOG} Ažurirano ${id}: ${changes.join(", ")}`);
    }

    const deactivated = await deactivateInactiveAvteraGlobally(supabase, fetchedIds);
    const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
    if (rec.error) console.warn(`${LOG} reconcile:`, rec.error);

    const agg = await aggregatePrices();
    if (agg.error) console.warn(`${LOG} aggregate:`, agg.error);

    const summary = {
      feed_items: feedCount,
      feed_valid: feedMap.size,
      db_offers: dbOffers.length,
      updated,
      deactivated: deactivated + deactivatedInLoop,
      reactivated,
      unchanged,
      prices_aggregated: agg.updated,
      ...(agg.error ? { aggregate_error: agg.error } : {})
    };
    console.log(`${LOG} Završeno.`, summary);

    return {
      success: !agg.error,
      summary
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${LOG}`, message);
    return { success: false, error: message };
  }
}
