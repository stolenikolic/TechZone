import { shopPageMetadata } from "lib/site-metadata";
import { NotFoundPageView } from "pages-sections/not-found";

export const metadata = shopPageMetadata("Stranica nije pronađena");

export default function NotFound() {
  return <NotFoundPageView />;
}
