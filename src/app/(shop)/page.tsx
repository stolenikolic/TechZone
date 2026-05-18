import { shopPageMetadata } from "lib/site-metadata";
import { MarketTwoPageView } from "pages-sections/market-2/page-view";

export const metadata = shopPageMetadata("Početna");

export const dynamic = "force-dynamic";

export default async function IndexPage() {
  return <MarketTwoPageView />;
}
