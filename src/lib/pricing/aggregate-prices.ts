import { createSupabaseServiceClient } from "utils/supabase";
import { convertToDisplayCurrency } from "./convert";

/** Number of supplier_products rows to fetch per query. Keep at 1000 to stay under PostgREST default row limit. */
const FETCH_PAGE_SIZE = 1000;
/** Number of products to update per RPC call. */
const UPDATE_BATCH_SIZE = 2500;

type SupplierProductRow = {
  product_id: string;
  supplier_id: string;
  price_amount: number;
  currency: string;
};

export type AggregatePricesResult = {
  /** Total number of products whose price was updated. */
  updated: number;
  /** Number of RPC batch calls made. */
  batches: number;
  /** Error message if the run failed partway. */
  error?: string;
};

/**
 * Fetches supplier_products in chunks, converts each row to KM, computes min price
 * per product, then batch-updates products.price via RPC. Idempotent; no full-table lock.
 */
export async function aggregatePrices(): Promise<AggregatePricesResult> {
  const supabase = createSupabaseServiceClient();
  const minPriceByProduct = new Map<string, number>();
  let offset = 0;

  while (true) {
    const { data: rows, error: fetchError } = await supabase
      .from("supplier_products")
      .select("product_id, supplier_id, price_amount, currency")
      .not("product_id", "is", null)
      .order("product_id", { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1);

    if (fetchError) {
      return {
        updated: minPriceByProduct.size,
        batches: 0,
        error: `supplier_products fetch failed: ${fetchError.message}`
      };
    }

    const chunk = (rows ?? []) as SupplierProductRow[];
    if (chunk.length === 0) break;

    for (const row of chunk) {
      const km = convertToDisplayCurrency(
        Number(row.price_amount),
        row.currency ?? "",
        row.supplier_id
      );
      const current = minPriceByProduct.get(row.product_id);
      if (current === undefined || km < current) {
        minPriceByProduct.set(row.product_id, km);
      }
    }

    offset += chunk.length;
    if (chunk.length < FETCH_PAGE_SIZE) break;
  }

  if (minPriceByProduct.size === 0) {
    return { updated: 0, batches: 0 };
  }

  const entries = Array.from(minPriceByProduct.entries()).map(
    ([id, price]) => ({ id, price })
  );
  let batches = 0;
  let updatedCount = 0;

  for (let i = 0; i < entries.length; i += UPDATE_BATCH_SIZE) {
    const batch = entries.slice(i, i + UPDATE_BATCH_SIZE);
    const { error: rpcError } = await supabase.rpc("update_products_prices", {
      entries: batch
    });

    if (rpcError) {
      return {
        updated: updatedCount,
        batches,
        error: `update_products_prices RPC failed: ${rpcError.message}`
      };
    }
    updatedCount += batch.length;
    batches += 1;
  }

  return {
    updated: updatedCount,
    batches
  };
}
