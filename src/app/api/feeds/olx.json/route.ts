import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { assertFeedAccess } from "lib/feeds/feed-auth";
import { OLX_FEED_STORAGE_PATH } from "lib/feeds/generate-and-store";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 300;

export async function GET(request: Request) {
  const denied = await assertFeedAccess(request);
  if (denied) return denied;

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from("feeds")
    .createSignedUrl(OLX_FEED_STORAGE_PATH, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    const message = error?.message ?? "Feed file not found";
    const status = message.toLowerCase().includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.redirect(data.signedUrl, 302);
}
