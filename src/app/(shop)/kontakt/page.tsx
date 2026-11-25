import { shopPageMetadata } from "lib/site-metadata";
import { ContactPageView } from "pages-sections/info";

export const metadata = shopPageMetadata(
  "Kontakt",
  "Telefon, Viber i e-mail Tech Zone online prodavnice."
);

export default function ContactPage() {
  return <ContactPageView />;
}
