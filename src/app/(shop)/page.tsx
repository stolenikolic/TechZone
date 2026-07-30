import { shopPageMetadata } from "lib/site-metadata";
import { HomepageView } from "pages-sections/homepage/page-view";

export const metadata = shopPageMetadata("Početna");

// No per-user data is rendered on the homepage; cache as ISR so most visitors
// get an instant CDN response instead of triggering a fresh SSR + DB round trip.
export const revalidate = 60;

export default async function IndexPage() {
  return <HomepageView />;
}
