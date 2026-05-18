import type { HomepageZone } from "lib/homepage/zones";
import type {
  DbHomepageBlock,
  HeroCarouselItem,
  HeroSideBannerItem,
  HomepagePayload,
  PromoBlockItem
} from "lib/homepage/types";
import {
  parseHeroCarouselContent,
  parseHeroSideContent,
  parsePromoContent
} from "lib/homepage/validation";

type DbRow = {
  id: string;
  zone: string;
  sort_order: number;
  is_active: boolean;
  image_url: string | null;
  content: unknown;
  created_at: string;
  updated_at: string;
};

export function rowToDbBlock(row: DbRow): DbHomepageBlock {
  const zone = row.zone as HomepageZone;
  let content;
  switch (zone) {
    case "hero_carousel":
      content = parseHeroCarouselContent(row.content);
      break;
    case "hero_side":
      content = parseHeroSideContent(row.content);
      break;
    case "promo":
      content = parsePromoContent(row.content);
      break;
    default:
      throw new Error(`Unknown homepage zone: ${row.zone}`);
  }
  return {
    id: row.id,
    zone,
    sort_order: row.sort_order,
    is_active: row.is_active,
    image_url: row.image_url,
    content,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function toHeroCarousel(row: DbHomepageBlock): HeroCarouselItem | null {
  if (row.zone !== "hero_carousel" || !row.image_url?.trim()) return null;
  const c = parseHeroCarouselContent(row.content);
  return {
    id: row.id,
    title: c.title,
    imgUrl: row.image_url.trim(),
    category: c.categoryLabel,
    buttonLink: c.buttonLink,
    buttonLabel: c.buttonLabel,
    description: c.description
  };
}

function toHeroSide(row: DbHomepageBlock): HeroSideBannerItem | null {
  if (row.zone !== "hero_side" || !row.image_url?.trim()) return null;
  const c = parseHeroSideContent(row.content);
  return {
    id: row.id,
    tag: c.tag,
    title: c.title,
    imgUrl: row.image_url.trim(),
    linkUrl: c.linkUrl,
    buttonLabel: c.buttonLabel
  };
}

function toPromo(row: DbHomepageBlock): PromoBlockItem | null {
  if (row.zone !== "promo" || !row.image_url?.trim()) return null;
  const c = parsePromoContent(row.content);
  return {
    id: row.id,
    title: c.title,
    description: c.description,
    imgUrl: row.image_url.trim(),
    buttonLink: c.buttonLink,
    buttonLabel: c.buttonLabel
  };
}

export function rowsToHomepagePayload(rows: DbRow[]): HomepagePayload {
  const blocks = rows.map(rowToDbBlock);
  const heroCarousel: HeroCarouselItem[] = [];
  const heroSide: HeroSideBannerItem[] = [];
  const promo: PromoBlockItem[] = [];

  for (const block of blocks) {
    if (!block.is_active) continue;
    if (block.zone === "hero_carousel") {
      const item = toHeroCarousel(block);
      if (item) heroCarousel.push(item);
    } else if (block.zone === "hero_side") {
      const item = toHeroSide(block);
      if (item) heroSide.push(item);
    } else if (block.zone === "promo") {
      const item = toPromo(block);
      if (item) promo.push(item);
    }
  }

  return { heroCarousel, heroSide, promo };
}
