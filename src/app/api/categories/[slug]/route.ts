import { NextResponse } from "next/server";
import {
  getCategoryProductsForPath,
  slugParamToSegments,
  type CategoryListingError
} from "lib/shop-category-listing";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const slugSegments = slugParamToSegments(slug);

    if (slugSegments.length === 0) {
      return NextResponse.json({ error: "Category path required" }, { status: 404 });
    }

    const url = new URL(request.url);
    const filterParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      filterParams[key] = value;
    });

    const result = await getCategoryProductsForPath(slug, filterParams);

    if (result == null) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (isListingError(result)) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[categories GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isListingError(
  result: unknown
): result is CategoryListingError {
  return (
    typeof result === "object" &&
    result != null &&
    "error" in result &&
    "status" in result &&
    !("products" in result)
  );
}
