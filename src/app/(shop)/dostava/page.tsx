import { shopPageMetadata } from "lib/site-metadata";
import { DeliveryPageView } from "pages-sections/info";

export const metadata = shopPageMetadata(
  "Dostava",
  "Dostava Tech Zone ide na adresu u Bosni i Hercegovini. Rok zavisi od dostupnosti robe."
);

export default function DeliveryPage() {
  return <DeliveryPageView />;
}
