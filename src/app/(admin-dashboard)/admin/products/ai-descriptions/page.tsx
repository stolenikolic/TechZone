import { adminPageMetadata } from "lib/site-metadata";
import { AiDescriptionsReviewPageView } from "pages-sections/vendor-dashboard/products/page-view/ai-descriptions-review";

export const metadata = adminPageMetadata("AI opisi — pregled");

export default function AiDescriptionsReviewPage() {
  return <AiDescriptionsReviewPageView />;
}
