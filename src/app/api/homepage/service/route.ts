import { NextResponse } from "next/server";
import { HOMEPAGE_SERVICES } from "lib/homepage/sections/static-data";

export async function GET() {
  return NextResponse.json(HOMEPAGE_SERVICES);
}
