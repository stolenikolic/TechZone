"use server";

import { getAuthUser } from "lib/auth/session";
import { createSupabaseServerClient } from "utils/supabase/server";
import { revalidateReviewSurfaces } from "./revalidate";

const PRODUCT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SubmitReviewResult =
  | { ok: true }
  | { ok: false; code: "auth" | "error"; message: string };

function mapReviewError(message: string): string {
  if (message.includes("review_not_authenticated")) {
    return "Prijavite se da biste ostavili recenziju.";
  }
  if (message.includes("review_invalid_rating")) {
    return "Odaberite ocjenu od 1 do 5.";
  }
  if (message.includes("review_comment_too_long")) {
    return "Recenzija može imati najviše 1000 znakova.";
  }
  if (message.includes("review_product_missing")) {
    return "Proizvod nije pronađen.";
  }
  return "Recenziju nije moguće sačuvati. Pokušajte ponovo.";
}

export async function submitProductReview(
  productId: string,
  rating: number,
  comment: string
): Promise<SubmitReviewResult> {
  if (!PRODUCT_ID_RE.test(productId)) {
    return { ok: false, code: "error", message: "Proizvod nije pronađen." };
  }

  const stars = Math.round(Number(rating));
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { ok: false, code: "error", message: "Odaberite ocjenu od 1 do 5." };
  }

  const text = comment.trim();
  if (text.length > 1000) {
    return { ok: false, code: "error", message: "Recenzija može imati najviše 1000 znakova." };
  }

  const user = await getAuthUser();
  if (!user) {
    return { ok: false, code: "auth", message: "Prijavite se da biste ostavili recenziju." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_product_review", {
    p_product_id: productId,
    p_rating: stars,
    p_comment: text
  });

  if (error) {
    console.warn("[product-reviews]", error.message);
    const code = error.message.includes("review_not_authenticated") ? "auth" : "error";
    return { ok: false, code, message: mapReviewError(error.message) };
  }

  await revalidateReviewSurfaces(productId);
  return { ok: true };
}
