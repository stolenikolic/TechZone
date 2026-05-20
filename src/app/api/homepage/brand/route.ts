import { NextResponse } from "next/server";
import { HOMEPAGE_BRANDS } from "lib/homepage/sections/static-data";

export async function GET() {
  return NextResponse.json(HOMEPAGE_BRANDS);
}
