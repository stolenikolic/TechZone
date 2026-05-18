import { NextResponse } from "next/server";
import { loadHomepageBlocksForAdmin } from "lib/homepage/load-homepage";
import { revalidateHomepageSurfaces } from "lib/homepage/revalidate";
import { assertCanAddBlock, assertCanActivateBlock } from "lib/homepage/zone-limits";
import { isHomepageZone, type HomepageZone } from "lib/homepage/zones";
import { parseContentForZone } from "lib/homepage/validation";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneParam = searchParams.get("zone");
    const zone =
      zoneParam && isHomepageZone(zoneParam) ? (zoneParam as HomepageZone) : undefined;
    const blocks = await loadHomepageBlocksForAdmin(zone);
    return NextResponse.json({ blocks });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PostBody = {
  zone?: string;
  sortOrder?: number;
  isActive?: boolean;
  imageUrl?: string | null;
  content?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostBody;
    if (!body.zone || !isHomepageZone(body.zone)) {
      return NextResponse.json({ error: "Valid zone is required." }, { status: 400 });
    }
    const zone = body.zone;

    await assertCanAddBlock(zone);

    const content = parseContentForZone(zone, body.content ?? {});
    const isActive = body.isActive !== false;

    if (isActive) {
      await assertCanActivateBlock(zone);
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("homepage_blocks")
      .insert({
        zone,
        sort_order: Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0,
        is_active: isActive,
        image_url: body.imageUrl?.trim() || null,
        content
      })
      .select("id, zone, sort_order, is_active, image_url, content, created_at, updated_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    revalidateHomepageSurfaces();
    return NextResponse.json({ block: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("Maximum") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
