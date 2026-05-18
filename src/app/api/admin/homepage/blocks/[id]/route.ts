import { NextResponse } from "next/server";
import { rowToDbBlock } from "lib/homepage/map-blocks";
import { processHomepageImageFromUrl } from "lib/images/process-homepage-image";
import { isHostedHomepageImage, removeHomepageImage } from "lib/images/storage";
import { revalidateHomepageSurfaces } from "lib/homepage/revalidate";
import { assertCanActivateBlock } from "lib/homepage/zone-limits";
import type { HomepageZone } from "lib/homepage/zones";
import { parseContentForZone } from "lib/homepage/validation";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";

type PatchBody = {
  sortOrder?: number;
  isActive?: boolean;
  imageUrl?: string | null;
  content?: unknown;
};

async function loadBlock(supabase: ReturnType<typeof createSupabaseServiceClient>, id: string) {
  const { data, error } = await supabase
    .from("homepage_blocks")
    .select("id, zone, sort_order, is_active, image_url, content, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToDbBlock(data);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();
    const block = await loadBlock(supabase, id);
    if (!block) return NextResponse.json({ error: "Block not found." }, { status: 404 });
    return NextResponse.json({ block });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;
    const supabase = createSupabaseServiceClient();
    const existing = await loadBlock(supabase, id);
    if (!existing) return NextResponse.json({ error: "Block not found." }, { status: 404 });

    const zone = existing.zone as HomepageZone;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ("sortOrder" in body && Number.isFinite(body.sortOrder)) {
      patch.sort_order = Number(body.sortOrder);
    }

    if ("isActive" in body) {
      const nextActive = Boolean(body.isActive);
      if (nextActive && !existing.is_active) {
        await assertCanActivateBlock(zone, id);
      }
      patch.is_active = nextActive;
    }

    if ("content" in body) {
      patch.content = parseContentForZone(zone, body.content);
    }

    if ("imageUrl" in body) {
      const raw = body.imageUrl?.trim() || null;
      if (!raw) {
        await removeHomepageImage(supabase, id, existing.image_url);
        patch.image_url = null;
      } else if (isHostedHomepageImage(raw, id)) {
        patch.image_url = raw;
      } else {
        patch.image_url = await processHomepageImageFromUrl(
          supabase,
          id,
          zone,
          raw,
          existing.image_url
        );
      }
    }

    const { data, error } = await supabase
      .from("homepage_blocks")
      .update(patch)
      .eq("id", id)
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

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();
    const existing = await loadBlock(supabase, id);
    if (!existing) return NextResponse.json({ error: "Block not found." }, { status: 404 });

    await removeHomepageImage(supabase, id, existing.image_url);
    const { error } = await supabase.from("homepage_blocks").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    revalidateHomepageSurfaces();
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
