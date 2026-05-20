import { loadActiveHomepage } from "lib/homepage/load-homepage";
import type { HeroCarouselItem } from "lib/homepage/types";

export async function loadHomepageMainCarousel(): Promise<HeroCarouselItem[]> {
  const { heroCarousel } = await loadActiveHomepage(true);
  return heroCarousel;
}
