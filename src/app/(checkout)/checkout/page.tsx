import { shopPageMetadata } from "lib/site-metadata";
import CheckoutPageView from "pages-sections/checkout/page-view";

export const metadata = shopPageMetadata("Narudžba");

export default function Checkout() {
  return <CheckoutPageView />;
}
