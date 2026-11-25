import { shopPageMetadata } from "lib/site-metadata";
import { AboutPageView } from "pages-sections/info";

export const metadata = shopPageMetadata(
  "O nama",
  "Tech Zone je online prodavnica računarske opreme i komponenti u Bosni i Hercegovini."
);

export default function AboutPage() {
  return <AboutPageView />;
}
