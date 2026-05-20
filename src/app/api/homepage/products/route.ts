import { NextResponse } from "next/server";
import { loadHomepageProducts } from "lib/homepage/sections/load-products";

export async function GET() {
  return NextResponse.json(await loadHomepageProducts());
}
