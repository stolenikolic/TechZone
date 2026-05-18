import { adminPageMetadata } from "lib/site-metadata";
import { PayoutSettingsPageView } from "pages-sections/vendor-dashboard/payout-settings/page-view";

export const metadata = adminPageMetadata("Postavke isplate");

export default function PayoutSettings() {
  return <PayoutSettingsPageView />;
}
