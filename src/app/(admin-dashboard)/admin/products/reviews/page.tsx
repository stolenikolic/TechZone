import { adminPageMetadata } from "lib/site-metadata";
import type Review from "models/Review.model";
import { ProductReviewsPageView } from "pages-sections/vendor-dashboard/products/page-view";
import { createSupabaseServiceClient } from "utils/supabase";

export const metadata = adminPageMetadata("Recenzije proizvoda");

const PLACEHOLDER = "/assets/images/placeholder.png";

type ReviewProduct = {
  id: string;
  name: string | null;
  main_image: string | null;
  slug: string | null;
};

export default async function ProductReviews() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, rating, comment, author_name, status, product_id, products(id, name, main_image, slug)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn("[admin/products/reviews]", error.message);
    throw new Error("Recenzije nije moguće učitati.");
  }

  const reviews: Review[] = (data ?? []).map((row) => {
    const product = (Array.isArray(row.products) ? row.products[0] : row.products) as ReviewProduct | null;
    const author = row.author_name?.trim() || "Kupac";

    return {
      id: row.id,
      rating: Number(row.rating),
      comment: row.comment ?? "",
      published: row.status === "published",
      customer: {
        id: row.id,
        email: "",
        phone: "",
        avatar: "",
        verified: true,
        name: { firstName: author, lastName: "" }
      },
      product: {
        id: product?.id ?? row.product_id,
        slug: product?.slug ?? "",
        title: product?.name?.trim() || "Proizvod",
        price: 0,
        rating: Number(row.rating),
        discount: 0,
        thumbnail: product?.main_image || PLACEHOLDER,
        images: [],
        categories: []
      }
    };
  });

  return <ProductReviewsPageView reviews={reviews} />;
}
