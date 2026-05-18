import { adminPageMetadata } from "lib/site-metadata";
import { AccountSettingsPageView } from "pages-sections/vendor-dashboard/account-settings/page-view";

export const metadata = adminPageMetadata("Postavke računa");

export default function AccountSettings() {
  return <AccountSettingsPageView />;
}
