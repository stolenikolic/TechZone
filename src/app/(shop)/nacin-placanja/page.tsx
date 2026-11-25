import { shopPageMetadata } from "lib/site-metadata";
import { PaymentInfoPageView } from "pages-sections/info";

export const metadata = shopPageMetadata(
  "Plaćanje",
  "Narudžbu na Tech Zone plaćate pouzećem, pri preuzimanju pošiljke, ili žiralno, uplatom na račun."
);

export default function PaymentInfoPage() {
  return <PaymentInfoPageView />;
}
