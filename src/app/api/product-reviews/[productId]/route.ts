import { NextResponse } from "next/server";
import { getAuthUser } from "lib/auth/session";
import { getViewerReviewState } from "lib/reviews/queries";

const PRODUCT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  if (!PRODUCT_ID_RE.test(productId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { authenticated: false, review: null },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  try {
    const state = await getViewerReviewState(user.id, productId);
    return NextResponse.json(
      { authenticated: true, review: state.review },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review state failed";
    console.warn("[product-reviews]", message);
    return NextResponse.json({ error: "Review state failed" }, { status: 500 });
  }
}
