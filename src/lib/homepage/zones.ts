export const HOMEPAGE_ZONES = ["hero_carousel", "hero_side", "promo"] as const;

export type HomepageZone = (typeof HOMEPAGE_ZONES)[number];

export const HOMEPAGE_ZONE_LIMITS: Record<HomepageZone, number | null> = {
  hero_carousel: null,
  hero_side: 2,
  promo: 2
};

export function isHomepageZone(value: string): value is HomepageZone {
  return (HOMEPAGE_ZONES as readonly string[]).includes(value);
}
