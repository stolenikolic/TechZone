import { NextResponse } from "next/server";
import { assertFeedAccess } from "lib/feeds/feed-auth";
import { buildOlxFeed } from "lib/feeds/olx-feed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEST_FEED_LIMIT = 50;

export async function GET(request: Request) {
  const denied = await assertFeedAccess(request);
  if (denied) return denied;

  try {
    const feed = await buildOlxFeed({ limit: TEST_FEED_LIMIT });
    return NextResponse.json({
      schema_version: feed.schema_version,
      generated_at: feed.generated_at,
      count: feed.count,
      products: feed.products
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[olx-test-feed]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
