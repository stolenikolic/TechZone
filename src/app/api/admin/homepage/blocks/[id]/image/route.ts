import { NextResponse } from "next/server";
import { rowToDbBlock } from "lib/homepage/map-blocks";
import { processHomepageImageFromBuffer } from "lib/images/process-homepage-image";
import { revalidateHomepageSurfaces } from "lib/homepage/revalidate";
import type { HomepageZone } from "lib/homepage/zones";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";

/** POST multipart: file → WebP → Storage → homepage_blocks.image_url */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: row, error: loadError } = await supabase
      .from("homepage_blocks")
      .select("id, zone, sort_order, is_active, image_url, content, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 400 });
    if (!row) return NextResponse.json({ error: "Block not found." }, { status: 404 });

    const block = rowToDbBlock(row);
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageUrl = await processHomepageImageFromBuffer(
      supabase,
      id,
      block.zone as HomepageZone,
      buffer,
      block.image_url
    );

    const { error: updateError } = await supabase
      .from("homepage_blocks")
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    revalidateHomepageSurfaces();
    return NextResponse.json({ imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
