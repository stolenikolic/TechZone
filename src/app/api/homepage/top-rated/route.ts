import { NextResponse } from "next/server";
import { loadHomepageTopRated } from "lib/homepage/sections/load-top-rated";

export async function GET() {
  return NextResponse.json(await loadHomepageTopRated());
}
