import { withHomepageFallbacks } from "lib/homepage/fallbacks";
import { rowsToHomepagePayload } from "lib/homepage/map-blocks";
import type { HomepagePayload } from "lib/homepage/types";
import type { HomepageZone } from "lib/homepage/zones";
import { rowToDbBlock } from "lib/homepage/map-blocks";
import { createSupabaseServiceClient } from "utils/supabase";

export async function loadActiveHomepage(
  applyFallback = true
): Promise<HomepagePayload> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("homepage_blocks")
    .select("id, zone, sort_order, is_active, image_url, content, created_at, updated_at")
    .eq("is_active", true)
    .order("zone")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[homepage] load failed:", error.message);
    return applyFallback ? withHomepageFallbacks({ heroCarousel: [], heroSide: [], promo: [] }) : { heroCarousel: [], heroSide: [], promo: [] };
  }

  const payload = rowsToHomepagePayload(data ?? []);
  return applyFallback ? withHomepageFallbacks(payload) : payload;
}

export async function loadHomepageBlocksForAdmin(zone?: HomepageZone) {
  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("homepage_blocks")
    .select("id, zone, sort_order, is_active, image_url, content, created_at, updated_at")
    .order("sort_order", { ascending: true });

  if (zone) {
    query = query.eq("zone", zone);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToDbBlock);
}

export async function countActiveBlocksInZone(zone: HomepageZone, excludeId?: string) {
  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("homepage_blocks")
    .select("id", { count: "exact", head: true })
    .eq("zone", zone)
    .eq("is_active", true);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}
