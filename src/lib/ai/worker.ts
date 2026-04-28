import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import { processSingleProductAttributes } from "lib/ai/attribute-generator";

const BATCH_SIZE = 10;
const DELAY_BETWEEN_PRODUCTS_MS = 1000;
const DELAY_WHEN_EMPTY_MS = 30_000;
const RATE_LIMIT_WAIT_MS = 10_000;
const MAX_RETRY_COUNT = 3;

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category_id: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detect OpenAI (or fetch) 429 Rate Limit errors.
 */
function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const status = (err as { status?: number }).status ?? (err as { statusCode?: number }).statusCode;
    if (status === 429) return true;
    const response = (err as { response?: { status?: number } }).response;
    if (response?.status === 429) return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("429") || message.toLowerCase().includes("rate limit");
}

/**
 * Fetch products that need AI attribute generation: pending or failed, not yet generated, retry count ≤ 3.
 */
export async function getPendingProducts(
  supabase: SupabaseClient,
  limit: number = BATCH_SIZE
): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, category_id")
    .in("ai_status", ["pending", "failed"])
    .eq("attributes_generated", false)
    .lte("ai_retry_count", MAX_RETRY_COUNT)
    .not("category_id", "is", null)
    .order("ai_retry_count", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`getPendingProducts failed: ${error.message}`);
  return (data ?? []) as ProductRow[];
}

/**
 * Claim a product for processing. Only updates if current state is pending or failed (safe for multiple workers).
 * Returns true if this worker claimed the row, false if another worker did or row no longer eligible.
 */
export async function markProcessing(
  supabase: SupabaseClient,
  productId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("products")
    .update({ ai_status: "processing" })
    .eq("id", productId)
    .in("ai_status", ["pending", "failed"])
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`markProcessing failed: ${error.message}`);
  return data != null;
}

/**
 * Mark product as successfully processed; attributes have been generated.
 */
export async function markDone(
  supabase: SupabaseClient,
  productId: string
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({
      ai_status: "done",
      attributes_generated: true
    })
    .eq("id", productId);

  if (error) throw new Error(`markDone failed: ${error.message}`);
}

/**
 * Mark product as failed; increment retry count. Stop retrying when ai_retry_count > 3.
 */
export async function markFailed(
  supabase: SupabaseClient,
  productId: string
): Promise<void> {
  const { data: row, error: selectError } = await supabase
    .from("products")
    .select("ai_retry_count")
    .eq("id", productId)
    .single();

  if (selectError) throw new Error(`markFailed select failed: ${selectError.message}`);
  const current = (row as { ai_retry_count: number } | null)?.ai_retry_count ?? 0;

  const { error: updateError } = await supabase
    .from("products")
    .update({
      ai_status: "failed",
      ai_retry_count: current + 1
    })
    .eq("id", productId);

  if (updateError) throw new Error(`markFailed failed: ${updateError.message}`);
}

/**
 * Reset ai_status to 'pending' after 429 so the product is retried without burning a retry count.
 */
async function markBackToPending(
  supabase: SupabaseClient,
  productId: string
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ ai_status: "pending" })
    .eq("id", productId);

  if (error) throw new Error(`markBackToPending failed: ${error.message}`);
}

/**
 * Process one product: claim, generate attributes, mark done or failed. On 429, wait and reset to pending.
 */
async function processOne(
  supabase: SupabaseClient,
  product: ProductRow
): Promise<void> {
  const claimed = await markProcessing(supabase, product.id);
  if (!claimed) return;

  try {
    const { inserted } = await processSingleProductAttributes(supabase, product);
    await markDone(supabase, product.id);
    console.log(`Done: ${product.id} (inserted ${inserted} attributes)`);
  } catch (err) {
    if (isRateLimitError(err)) {
      console.log("Rate limited, waiting...");
      await sleep(RATE_LIMIT_WAIT_MS);
      await markBackToPending(supabase, product.id);
      return;
    }
    await markFailed(supabase, product.id);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed: ${product.id} - ${message}`);
  }
}

/**
 * Run the AI attribute worker loop. Continuously fetches pending products in small batches,
 * processes them with rate limiting and 429 handling, then sleeps when the queue is empty.
 * Safe for production: no uncontrolled loops, bounded batch size, delays between requests.
 */
export async function runWorker(): Promise<never> {
  const supabase = createSupabaseServiceClient();

  while (true) {
    const batch = await getPendingProducts(supabase, BATCH_SIZE);

    if (batch.length === 0) {
      await sleep(DELAY_WHEN_EMPTY_MS);
      continue;
    }

    for (const product of batch) {
      console.log(`Processing product: ${product.name}`);
      await processOne(supabase, product);
      await sleep(DELAY_BETWEEN_PRODUCTS_MS);
    }
  }
}
