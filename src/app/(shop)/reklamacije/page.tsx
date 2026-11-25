import { shopPageMetadata } from "lib/site-metadata";
import { ReturnsPageView } from "pages-sections/info";

export const metadata = shopPageMetadata(
  "Reklamacije i povrat",
  "Kako da javite Tech Zone ako proizvod koji ste primili nije ispravan."
);

export default function ReturnsPage() {
  return <ReturnsPageView />;
}
