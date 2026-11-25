import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseServiceClient } from "utils/supabase";
import { productReviewsTag } from "./tags";
import type { ProductReviewSummary, ReviewStar, ViewerReviewState } from "./types";

const REVIEW_LIST_LIMIT = 50;

const emptyDistribution = (): Record<ReviewStar, number> => ({
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0
});

function asStar(value: number): ReviewStar | null {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
  return null;
}

async function loadPublishedProductReviews(productId: string): Promise<ProductReviewSummary> {
  const supabase = createSupabaseServiceClient();
  const [productResult, listResult, ratingResult] = await Promise.all([
    supabase.from("products").select("rating, rating_count").eq("id", productId).maybeSingle(),
    supabase
      .from("product_reviews")
      .select("id, user_id, rating, comment, author_name, created_at, order_id")
      .eq("product_id", productId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(REVIEW_LIST_LIMIT),
    supabase
      .from("product_reviews")
      .select("rating")
      .eq("product_id", productId)
      .eq("status", "published")
      .limit(1000)
  ]);

  if (productResult.error) console.warn("[product-reviews]", productResult.error.message);
  if (listResult.error) console.warn("[product-reviews]", listResult.error.message);
  if (ratingResult.error) console.warn("[product-reviews]", ratingResult.error.message);

  const rows = listResult.data ?? [];
  const userIds = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
  const avatarByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .in("id", userIds);
    if (profileError) console.warn("[product-reviews]", profileError.message);
    for (const profile of profiles ?? []) {
      if (profile.avatar_url) avatarByUser.set(profile.id, profile.avatar_url);
    }
  }

  const distribution = emptyDistribution();
  for (const row of ratingResult.data ?? []) {
    const star = asStar(Number(row.rating));
    if (star) distribution[star] += 1;
  }

  const counted = distribution[1] + distribution[2] + distribution[3] + distribution[4] + distribution[5];
  const count =
    productResult.data?.rating_count != null ? Number(productResult.data.rating_count) : counted;
  const average =
    count > 0 && productResult.data?.rating != null ? Number(productResult.data.rating) : 0;

  return {
    average: Math.min(5, Math.max(0, average)),
    count: Number.isFinite(count) ? count : 0,
    distribution,
    reviews: rows.map((row) => ({
      id: row.id,
      rating: Number(row.rating),
      comment: row.comment,
      authorName: row.author_name,
      authorAvatar: avatarByUser.get(row.user_id) ?? null,
      createdAt: row.created_at,
      verifiedPurchase: Boolean(row.order_id)
    }))
  };
}

export const getPublishedProductReviews = cache((productId: string) =>
  unstable_cache(() => loadPublishedProductReviews(productId), ["product-reviews", productId], {
    revalidate: 60,
    tags: [productReviewsTag(productId)]
  })()
);

export async function getViewerReviewState(userId: string, productId: string): Promise<ViewerReviewState> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("rating, comment, status")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) console.warn("[product-reviews]", error.message);

  const status = data?.status;
  const review =
    data && (status === "published" || status === "hidden")
      ? {
          rating: Number(data.rating),
          comment: data.comment,
          status
        }
      : null;

  return { review };
}
