import { NextResponse } from "next/server";
import { FEEDS_BUCKET } from "lib/images/constants";
import { assertFeedAccess } from "lib/feeds/feed-auth";
import { OLX_FEED_STORAGE_PATH } from "lib/feeds/generate-and-store";
import { createR2PresignedGetUrl } from "lib/storage/r2";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 300;

export async function GET(request: Request) {
  const denied = await assertFeedAccess(request);
  if (denied) return denied;

  try {
    const signedUrl = await createR2PresignedGetUrl(
      FEEDS_BUCKET,
      OLX_FEED_STORAGE_PATH,
      SIGNED_URL_TTL_SECONDS
    );
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Feed file not found";
    const status = message.toLowerCase().includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
