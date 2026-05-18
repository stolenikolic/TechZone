import { adminPageMetadata } from "lib/site-metadata";
import { ShopSettingsPageView } from "pages-sections/vendor-dashboard/shop-settings/page-view";

export const metadata = adminPageMetadata("Postavke trgovine");

export default function ShopSettings() {
  return <ShopSettingsPageView />;
}
