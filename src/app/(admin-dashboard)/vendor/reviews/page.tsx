import { adminPageMetadata } from "lib/site-metadata";
import { ReviewsPageView } from "pages-sections/vendor-dashboard/reviews/page-view";
// API FUNCTIONS
import api from "utils/__api__/vendor";

export const metadata = adminPageMetadata("Recenzije");

export default async function Reviews() {
  const reviews = await api.getAllProductReviews();
  return <ReviewsPageView reviews={reviews} />;
}
