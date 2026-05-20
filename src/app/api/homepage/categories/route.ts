import { NextResponse } from "next/server";
import { loadHomepageCategories } from "lib/homepage/sections/load-categories";

export type { HomepageCategoryItem } from "lib/homepage/sections/load-categories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await loadHomepageCategories());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
