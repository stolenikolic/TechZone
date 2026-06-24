import { createSupabaseServiceClient } from "utils/supabase";
import { buildOlxFeed } from "./olx-feed";

export const OLX_FEED_STORAGE_PATH = "olx.json";

export type GenerateAndStoreOlxFeedResult = {
  success: boolean;
  count: number;
  skipped: number;
  bytes: number;
  durationMs: number;
  path: string;
  error?: string;
  summary: {
    count: number;
    skipped: number;
    bytes: number;
    durationMs: number;
    path: string;
  };
};

export async function generateAndStoreOlxFeed(): Promise<GenerateAndStoreOlxFeedResult> {
  const startedAt = Date.now();
  const feed = await buildOlxFeed();
  const body = JSON.stringify({
    schema_version: feed.schema_version,
    generated_at: feed.generated_at,
    count: feed.count,
    products: feed.products
  });
  const bytes = Buffer.byteLength(body, "utf8");

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.storage.from("feeds").upload(OLX_FEED_STORAGE_PATH, body, {
    contentType: "application/json",
    upsert: true,
    cacheControl: "300"
  });

  if (error) {
    const message = `storage upload failed: ${error.message}`;
    console.error(`[olx-feed] ${message}`);
    return {
      success: false,
      count: feed.count,
      skipped: feed.skipped,
      bytes,
      durationMs: Date.now() - startedAt,
      path: OLX_FEED_STORAGE_PATH,
      error: message,
      summary: {
        count: feed.count,
        skipped: feed.skipped,
        bytes,
        durationMs: Date.now() - startedAt,
        path: OLX_FEED_STORAGE_PATH
      }
    };
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    `[olx-feed] stored ${OLX_FEED_STORAGE_PATH}: count=${feed.count}, skipped=${feed.skipped}, bytes=${bytes}, ${durationMs}ms`
  );

  return {
    success: true,
    count: feed.count,
    skipped: feed.skipped,
    bytes,
    durationMs,
    path: OLX_FEED_STORAGE_PATH,
    summary: {
      count: feed.count,
      skipped: feed.skipped,
      bytes,
      durationMs,
      path: OLX_FEED_STORAGE_PATH
    }
  };
}
