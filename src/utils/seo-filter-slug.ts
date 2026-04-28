/**
 * SEO-friendly filter slug parsing for category landing pages.
 * Maps URL segments (e.g. 18tb, 7200rpm, 3-5-inch, wd) to the existing
 * query-parameter filter system used by the category API.
 */

/** Capacity: 1tb, 18tb → capacity=18-18 */
const CAPACITY_REGEX = /^(\d+)tb$/i;
/** RPM: 5400rpm, 7200rpm → rpm=7200-7200 */
const RPM_REGEX = /^(\d+)rpm$/i;
/** Size: 2-5-inch → 2.5, 3-5-inch → 3.5 */
const SIZE_REGEX = /^(\d)-(\d)-inch$/i;

/**
 * Parse a single filter slug into the equivalent query params for the category API.
 * Returns null if the slug does not match any known pattern.
 *
 * Examples:
 * 18tb → { capacity: "18-18" }
 * 7200rpm → { rpm: "7200-7200" }
 * 3-5-inch → { size: "3.5" }
 * wd → { brands: "wd" }
 */
export function seoFilterSlugToParams(slug: string): Record<string, string> | null {
  const s = slug.trim().toLowerCase();
  if (!s) return null;

  const capacityMatch = s.match(CAPACITY_REGEX);
  if (capacityMatch) {
    const n = capacityMatch[1];
    return { capacity: `${n}-${n}` };
  }

  const rpmMatch = s.match(RPM_REGEX);
  if (rpmMatch) {
    const n = rpmMatch[1];
    return { rpm: `${n}-${n}` };
  }

  const sizeMatch = s.match(SIZE_REGEX);
  if (sizeMatch) {
    const whole = sizeMatch[1];
    const frac = sizeMatch[2];
    return { size: `${whole}.${frac}` };
  }

  /** Brand: lowercase, may contain dashes (e.g. wd, western-digital). API uses "brands". */
  if (/^[a-z0-9][a-z0-9-]*$/.test(s)) {
    return { brands: s };
  }

  return null;
}

/**
 * Check if a path segment is a valid SEO filter slug.
 */
export function isSeoFilterSlug(slug: string): boolean {
  return seoFilterSlugToParams(slug) !== null;
}

/**
 * Parse multiple SEO filter segments and merge into one params object.
 * Each segment is parsed (e.g. wd → brands, 4tb → capacity); multiple brands
 * are joined with comma. Used for URLs like /categories/.../wd/4tb.
 */
export function seoFilterSegmentsToParams(segments: string[]): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const segment of segments) {
    const params = seoFilterSlugToParams(segment);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (key === "brands" && merged[key]) {
          merged[key] = [merged[key], value].join(",");
        } else {
          merged[key] = value;
        }
      }
    }
  }
  return merged;
}

/** Number of path segments that form the category (parent/child = 2). */
const CATEGORY_PATH_SEGMENT_COUNT = 2;

/**
 * From a pathname like /categories/racunarske-komponente/hard-diskovi/wd/4tb,
 * return the category base path and the parsed filter params from all trailing segments.
 * Requires at least categories + category path (3 segments); trailing = SEO filters.
 */
export function getSeoFilterFromPathname(pathname: string): {
  basePath: string;
  params: Record<string, string>;
} | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= CATEGORY_PATH_SEGMENT_COUNT + 1) return null;
  const filterSegments = segments.slice(CATEGORY_PATH_SEGMENT_COUNT + 1);
  if (filterSegments.length === 0) return null;
  const params = seoFilterSegmentsToParams(filterSegments);
  if (Object.keys(params).length === 0) return null;
  const basePath = "/" + segments.slice(0, CATEGORY_PATH_SEGMENT_COUNT + 1).join("/");
  return { basePath, params };
}
