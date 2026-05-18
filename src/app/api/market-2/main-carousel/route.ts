import { NextResponse } from "next/server";
import { loadActiveHomepage } from "lib/homepage/load-homepage";
import type { MainCarouselItem } from "models/Market-2.model";

export async function GET() {
  const { heroCarousel } = await loadActiveHomepage(true);
  const items: MainCarouselItem[] = heroCarousel.map((item) => ({
    id: item.id,
    title: item.title,
    imgUrl: item.imgUrl,
    category: item.category,
    buttonLink: item.buttonLink,
    buttonLabel: item.buttonLabel,
    description: item.description
  }));
  return NextResponse.json(items);
}
