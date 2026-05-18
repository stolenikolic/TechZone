import type { HomepageZone } from "lib/homepage/zones";
import type {
  HeroCarouselContent,
  HeroSideContent,
  HomepageBlockContent,
  PromoContent
} from "lib/homepage/types";

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

export function parseHeroCarouselContent(raw: unknown): HeroCarouselContent {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    title: requireString(obj.title, "title"),
    categoryLabel: requireString(obj.categoryLabel ?? obj.category, "categoryLabel"),
    description: requireString(obj.description, "description"),
    buttonLink: requireString(obj.buttonLink, "buttonLink"),
    buttonLabel: requireString(obj.buttonLabel, "buttonLabel")
  };
}

export function parseHeroSideContent(raw: unknown): HeroSideContent {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    tag: requireString(obj.tag, "tag"),
    title: requireString(obj.title, "title"),
    linkUrl: requireString(obj.linkUrl ?? obj.url, "linkUrl"),
    buttonLabel: requireString(obj.buttonLabel, "buttonLabel")
  };
}

export function parsePromoContent(raw: unknown): PromoContent {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    title: requireString(obj.title, "title"),
    description: requireString(obj.description, "description"),
    buttonLink: requireString(obj.buttonLink, "buttonLink"),
    buttonLabel: requireString(obj.buttonLabel, "buttonLabel")
  };
}

export function parseContentForZone(zone: HomepageZone, raw: unknown): HomepageBlockContent {
  switch (zone) {
    case "hero_carousel":
      return parseHeroCarouselContent(raw);
    case "hero_side":
      return parseHeroSideContent(raw);
    case "promo":
      return parsePromoContent(raw);
    default:
      throw new Error("Invalid zone.");
  }
}
