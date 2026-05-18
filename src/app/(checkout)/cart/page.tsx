import { shopPageMetadata } from "lib/site-metadata";
import { CartPageView } from "pages-sections/cart/page-view";

export const metadata = shopPageMetadata("Korpa");

export default function Cart() {
  return <CartPageView />;
}
