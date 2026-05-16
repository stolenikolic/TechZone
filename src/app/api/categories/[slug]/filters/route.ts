import { NextResponse } from "next/server";
import {
  getCategoryFiltersForPath,
  slugParamToSegments,
  type CategoryFiltersResponse
} from "lib/shop-category-listing";
import type { FilterItem } from "models/Filters";

export type { FilterItem, CategoryFiltersResponse };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const slugSegments = slugParamToSegments(slug);

  if (!slugSegments.length) {
    return NextResponse.json({ error: "Category path required" }, { status: 404 });
  }

  const result = await getCategoryFiltersForPath(slug);

  if (result == null) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}
