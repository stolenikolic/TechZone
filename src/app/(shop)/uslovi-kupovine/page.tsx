import { shopPageMetadata } from "lib/site-metadata";
import { TermsPageView } from "pages-sections/info";

export const metadata = shopPageMetadata(
  "Uslovi kupovine",
  "Pravila narudžbe, plaćanja pouzećem ili žiralno, dostave i reklamacije na Tech Zone."
);

export default function TermsPage() {
  return <TermsPageView />;
}
