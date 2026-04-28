import type { Metadata } from "next";
import { MarketTwoPageView } from "pages-sections/market-2/page-view";

export const metadata: Metadata = {
  title: "Tech Zone"
};

export default async function IndexPage() {
  return <MarketTwoPageView />;
}
