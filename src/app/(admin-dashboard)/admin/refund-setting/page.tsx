import { adminPageMetadata } from "lib/site-metadata";
import { RefundSettingPageView } from "pages-sections/vendor-dashboard/refund-setting/page-view";

export const metadata = adminPageMetadata("Postavke povrata");

export default async function RefundSetting() {
  return <RefundSettingPageView />;
}
