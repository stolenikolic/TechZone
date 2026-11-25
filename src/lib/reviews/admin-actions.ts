"use server";

import { requireAdmin } from "lib/auth/session";
import { createSupabaseServiceClient } from "utils/supabase";
import { revalidateReviewSurfaces } from "./revalidate";

const REVIEW_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReviewAdminResult = { ok: true } | { ok: false; message: string };

async function productIdForReview(reviewId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("product_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (error || !data?.product_id) return null;
  return data.product_id as string;
}

export async function setProductReviewPublished(
  reviewId: string,
  published: boolean
): Promise<ReviewAdminResult> {
  await requireAdmin();
  if (!REVIEW_ID_RE.test(reviewId)) {
    return { ok: false, message: "Recenzija nije pronađena." };
  }

  const productId = await productIdForReview(reviewId);
  if (!productId) return { ok: false, message: "Recenzija nije pronađena." };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("product_reviews")
    .update({
      status: published ? "published" : "hidden",
      updated_at: new Date().toISOString()
    })
    .eq("id", reviewId);

  if (error) {
    console.warn("[admin/reviews]", error.message);
    return { ok: false, message: "Status recenzije nije sačuvan." };
  }

  await revalidateReviewSurfaces(productId);
  return { ok: true };
}

export async function deleteProductReview(reviewId: string): Promise<ReviewAdminResult> {
  await requireAdmin();
  if (!REVIEW_ID_RE.test(reviewId)) {
    return { ok: false, message: "Recenzija nije pronađena." };
  }

  const productId = await productIdForReview(reviewId);
  if (!productId) return { ok: false, message: "Recenzija nije pronađena." };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("product_reviews").delete().eq("id", reviewId);

  if (error) {
    console.warn("[admin/reviews]", error.message);
    return { ok: false, message: "Recenziju nije moguće obrisati." };
  }

  await revalidateReviewSurfaces(productId);
  return { ok: true };
}
