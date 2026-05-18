import { adminPageMetadata } from "lib/site-metadata";
import { VendorPayoutRequestsPageView } from "pages-sections/vendor-dashboard/v-payout-request/page-view";
// API FUNCTIONS
import api from "utils/__api__/vendor";

export const metadata = adminPageMetadata("Zahtjevi za isplatu");

export default async function PayoutRequests() {
  const requests = await api.getAllPayoutRequests();
  return <VendorPayoutRequestsPageView payoutRequests={requests} />;
}
