import { countActiveBlocksInZone, loadHomepageBlocksForAdmin } from "lib/homepage/load-homepage";
import { HOMEPAGE_ZONE_LIMITS, type HomepageZone } from "lib/homepage/zones";

export async function countBlocksInZone(zone: HomepageZone): Promise<number> {
  const blocks = await loadHomepageBlocksForAdmin(zone);
  return blocks.length;
}

export async function assertCanAddBlock(zone: HomepageZone): Promise<void> {
  const limit = HOMEPAGE_ZONE_LIMITS[zone];
  if (limit == null) return;
  const count = await countBlocksInZone(zone);
  if (count >= limit) {
    throw new Error(`Maximum ${limit} blocks allowed for zone "${zone}".`);
  }
}

export async function assertCanActivateBlock(
  zone: HomepageZone,
  excludeId?: string
): Promise<void> {
  const limit = HOMEPAGE_ZONE_LIMITS[zone];
  if (limit == null) return;
  const active = await countActiveBlocksInZone(zone, excludeId);
  if (active >= limit) {
    throw new Error(`Maximum ${limit} active blocks allowed for zone "${zone}".`);
  }
}
