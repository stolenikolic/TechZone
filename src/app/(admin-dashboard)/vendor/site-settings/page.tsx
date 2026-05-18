import { adminPageMetadata } from "lib/site-metadata";
import { SiteSettingsPageView } from "pages-sections/vendor-dashboard/site-settings/page-view";

export const metadata = adminPageMetadata("Postavke stranice");

export default function SiteSettings() {
  return <SiteSettingsPageView />;
}
