import { NextResponse } from "next/server";
import { loadHomepageFlashDeals } from "lib/homepage/sections/load-flash-deals";

export async function GET() {
  return NextResponse.json(await loadHomepageFlashDeals());
}
