import { NextResponse } from "next/server";
import { loadHomepageMainCarousel } from "lib/homepage/sections/load-carousel";

export async function GET() {
  return NextResponse.json(await loadHomepageMainCarousel());
}
