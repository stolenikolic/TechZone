import { NextResponse } from "next/server";
import type { MainCarouselItem } from "models/Market-2.model";

const MAIN_CAROUSEL_ITEMS: MainCarouselItem[] = [
  {
    id: 1,
    title: "Tech Deals",
    imgUrl: "/assets/images/hero/hero-1.jpg",
    category: "Electronics",
    buttonLink: "/products",
    description: "Discover the latest gadgets and tech essentials."
  },
  {
    id: 2,
    title: "New Arrivals",
    imgUrl: "/assets/images/hero/hero-2.jpg",
    category: "Featured",
    buttonLink: "/products",
    description: "Explore new products and exclusive offers."
  }
];

export async function GET() {
  return NextResponse.json(MAIN_CAROUSEL_ITEMS);
}
