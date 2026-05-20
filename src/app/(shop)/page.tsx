import { shopPageMetadata } from "lib/site-metadata";
import { HomepageView } from "pages-sections/homepage/page-view";

export const metadata = shopPageMetadata("Početna");

export const dynamic = "force-dynamic";

export default async function IndexPage() {
  return <HomepageView />;
}
