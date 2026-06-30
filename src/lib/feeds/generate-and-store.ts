import { FEEDS_BUCKET } from "lib/images/constants";
import { uploadR2Object } from "lib/storage/r2";
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

  try {
    await uploadR2Object(
      FEEDS_BUCKET,
      OLX_FEED_STORAGE_PATH,
      Buffer.from(body, "utf8"),
      "application/json",
      "max-age=300"
    );
  } catch (error) {
    const message = `storage upload failed: ${error instanceof Error ? error.message : String(error)}`;
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
