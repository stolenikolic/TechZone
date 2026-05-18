import { adminPageMetadata } from "lib/site-metadata";
import { HomepageSettingsPageView } from "pages-sections/vendor-dashboard/homepage/page-view";

export const metadata = adminPageMetadata("Početna stranica");

export default function AdminHomepagePage() {
  return <HomepageSettingsPageView />;
}
