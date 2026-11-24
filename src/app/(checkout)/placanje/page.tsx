import { shopPageMetadata } from "lib/site-metadata";
import { PaymentPageView } from "pages-sections/payment/page-view";

export const metadata = shopPageMetadata("Plaćanje");

export default function Payment() {
  return <PaymentPageView />;
}
