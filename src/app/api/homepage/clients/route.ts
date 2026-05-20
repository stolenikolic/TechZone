import { NextResponse } from "next/server";
import { HOMEPAGE_CLIENTS } from "lib/homepage/sections/static-data";

export async function GET() {
  return NextResponse.json(HOMEPAGE_CLIENTS);
}
