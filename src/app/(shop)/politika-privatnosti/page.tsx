import { shopPageMetadata } from "lib/site-metadata";
import { PrivacyPageView } from "pages-sections/info";

export const metadata = shopPageMetadata(
  "Politika privatnosti",
  "Koje podatke Tech Zone traži pri narudžbi i registraciji i čemu služe."
);

export default function PrivacyPage() {
  return <PrivacyPageView />;
}
