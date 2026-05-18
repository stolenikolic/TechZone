import { adminPageMetadata } from "lib/site-metadata";
import { VendorPayoutsPageView } from "pages-sections/vendor-dashboard/v-payouts/page-view";
// API FUNCTIONS
import api from "utils/__api__/dashboard";

export const metadata = adminPageMetadata("Isplate");

export default async function VendorPayouts() {
  const payouts = await api.payouts();
  return <VendorPayoutsPageView payouts={payouts} />;
}
