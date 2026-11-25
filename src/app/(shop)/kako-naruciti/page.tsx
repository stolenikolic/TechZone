import { shopPageMetadata } from "lib/site-metadata";
import { HowToOrderPageView } from "pages-sections/info";

export const metadata = shopPageMetadata(
  "Kako naručiti",
  "Koraci narudžbe na Tech Zone: korpa, podaci za dostavu, pouzeće ili žiralna uplata."
);

export default function HowToOrderPage() {
  return <HowToOrderPageView />;
}
