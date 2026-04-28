import { NextResponse } from "next/server";
import { getLayoutData } from "lib/layout-data";

export async function GET() {
  return NextResponse.json(await getLayoutData());
}
